import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RegraGraduacaoDto } from './dtos/regra-graduacao.dto';
import { TipoTreinoDto } from './dtos/tipo-treino.dto';
import { UpdateRegraGraduacaoDto } from './dtos/update-regra-graduacao.dto';
import { MotivoCancelamentoDto } from './dtos/motivo-cancelamento.dto';

export type CurrentUser = {
  id: string;
  role: string;
  roles?: string[];
  academiaId: string;
};

@Injectable()
export class ConfigService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listarTiposTreino(currentUser: CurrentUser): Promise<TipoTreinoDto[]> {
    const tipos = await this.databaseService.query<{
      id: string;
      codigo: string;
      nome: string;
      descricao: string | null;
      cor_identificacao: string | null;
    }>(
      `
        select id, lower(codigo) as codigo, nome, descricao, cor_identificacao
          from tipos_treino
         where academia_id = $1
         order by lower(codigo) asc;
      `,
      [currentUser.academiaId],
    );

    return tipos.map((tipo) => ({
      id: tipo.codigo,
      uuid: tipo.id,
      nome: tipo.nome,
      descricao: tipo.descricao ?? undefined,
      corIdentificacao: tipo.cor_identificacao ?? null,
    }));
  }

  async listarRegrasGraduacao(academiaId: string): Promise<RegraGraduacaoDto[]> {
    // Busca regras da academia com fallback para defaults
    const rows = await this.databaseService.query<{
      faixa_slug: string;
      faixa_nome: string;
      categoria: string;
      graus_maximos: number;
      aulas_minimas: number;
      tempo_minimo_meses: number;
      meta_aulas_no_grau: number;
      frequencia_minima_semanal: number | null;
    }>(
      `
        SELECT 
          f.slug as faixa_slug,
          f.nome as faixa_nome,
          f.categoria,
          f.graus_maximos,
          COALESCE(r.aulas_minimas, d.aulas_minimas, 100) as aulas_minimas,
          COALESCE(r.tempo_minimo_meses, d.tempo_minimo_meses, 12) as tempo_minimo_meses,
          COALESCE(r.meta_aulas_no_grau, d.meta_aulas_no_grau, 25) as meta_aulas_no_grau,
          COALESCE(r.frequencia_minima_semanal, 0) as frequencia_minima_semanal
        FROM faixas f
        LEFT JOIN regras_graduacao r ON r.faixa_slug = f.slug AND r.academia_id = $1
        LEFT JOIN regras_graduacao_default d ON d.faixa_slug = f.slug
        ORDER BY f.ordem ASC
      `,
      [academiaId],
    );

    return rows.map((row) => ({
      faixaSlug: row.faixa_slug,
      faixaNome: row.faixa_nome,
      categoria: row.categoria,
      grausMaximos: row.graus_maximos,
      exibirGrausPreenchidos: row.categoria === 'HONORIFICA', // Faixas honoríficas sempre mostram graus cheios
      aulasMinimas: row.aulas_minimas,
      tempoMinimoMeses: row.tempo_minimo_meses,
      metaAulasNoGrau: row.meta_aulas_no_grau,
      frequenciaMinimaSemal: row.frequencia_minima_semanal || undefined,
    }));
  }

  async atualizarRegra(
    academiaId: string,
    faixaSlug: string,
    dto: UpdateRegraGraduacaoDto,
  ): Promise<RegraGraduacaoDto> {
    // Upsert da regra
    await this.databaseService.query(
      `
        INSERT INTO regras_graduacao (academia_id, faixa_slug, aulas_minimas, tempo_minimo_meses, meta_aulas_no_grau, frequencia_minima_semanal)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (academia_id, faixa_slug) 
        DO UPDATE SET 
          aulas_minimas = EXCLUDED.aulas_minimas,
          tempo_minimo_meses = EXCLUDED.tempo_minimo_meses,
          meta_aulas_no_grau = EXCLUDED.meta_aulas_no_grau,
          frequencia_minima_semanal = EXCLUDED.frequencia_minima_semanal
      `,
      [
        academiaId,
        faixaSlug,
        dto.aulasMinimas,
        dto.tempoMinimoMeses,
        dto.metaAulasNoGrau,
        dto.frequenciaMinimaSemal ?? null,
      ],
    );

    // Busca dados da faixa para retorno
    const faixa = await this.databaseService.queryOne<{ 
      nome: string; 
      categoria: string; 
      graus_maximos: number;
    }>(
      `SELECT nome, categoria, graus_maximos FROM faixas WHERE slug = $1`,
      [faixaSlug],
    );

    return {
      faixaSlug,
      faixaNome: faixa?.nome || faixaSlug,
      categoria: faixa?.categoria || 'ADULTO',
      grausMaximos: faixa?.graus_maximos || 4,
      exibirGrausPreenchidos: faixa?.categoria === 'HONORIFICA',
      aulasMinimas: dto.aulasMinimas,
      tempoMinimoMeses: dto.tempoMinimoMeses,
      metaAulasNoGrau: dto.metaAulasNoGrau,
      frequenciaMinimaSemal: dto.frequenciaMinimaSemal,
      observacoes: dto.observacoes,
    };
  }

  async resetarParaPadrao(academiaId: string): Promise<{ count: number }> {
    // Remove regras customizadas da academia
    await this.databaseService.query(
      `DELETE FROM regras_graduacao WHERE academia_id = $1`,
      [academiaId],
    );

    // Recria a partir dos defaults
    const result = await this.databaseService.query<{ count: number }>(
      `
        INSERT INTO regras_graduacao (id, academia_id, faixa_slug, aulas_minimas, tempo_minimo_meses, meta_aulas_no_grau)
        SELECT gen_random_uuid(), $1, faixa_slug, aulas_minimas, tempo_minimo_meses, meta_aulas_no_grau
        FROM regras_graduacao_default
        RETURNING 1
      `,
      [academiaId],
    );

    return { count: result.length };
  }

  /**
   * Lista motivos de cancelamento.
   * Busca da tabela `motivos_cancelamento` ou usa fallback hardcoded.
   * @param academiaId ID da academia
   * @param tipo 'PRESENCA' ou 'AULA'
   */
  async listarMotivosCancelamento(
    academiaId: string | null,
    tipo: 'PRESENCA' | 'AULA' = 'PRESENCA',
  ): Promise<MotivoCancelamentoDto[]> {
    try {
      // Busca motivos globais (academia_id IS NULL) ou específicos da academia, filtrando por tipo
      const rows = await this.databaseService.query<{
        id: string;
        label: string;
        icon: string;
      }>(
        `
        SELECT slug as id, label, icon
        FROM motivos_cancelamento
        WHERE ativo = true
          AND tipo = $1
          AND (academia_id IS NULL OR academia_id = $2)
        ORDER BY ordem ASC, label ASC
        `,
        [tipo, academiaId || null],
      );

      if (rows.length > 0) {
        return rows;
      }
    } catch (error) {
      // Table doesn't exist or column 'tipo' doesn't exist yet, use fallback
      console.log(`Tabela motivos_cancelamento (tipo=${tipo}) erro ou vazia, usando fallback`);
    }

    // Fallback: motivos padrão hardcoded
    if (tipo === 'AULA') {
      return [
        { id: 'instrutor_indisponivel', label: 'Instrutor indisponível', icon: 'person-remove-outline' },
        { id: 'feriado', label: 'Feriado / Recesso', icon: 'calendar-outline' },
        { id: 'manutencao', label: 'Manutenção do espaço', icon: 'construct-outline' },
        { id: 'baixa_demanda', label: 'Baixa demanda', icon: 'people-outline' },
        { id: 'evento_especial', label: 'Evento especial', icon: 'star-outline' },
        { id: 'emergencia', label: 'Emergência', icon: 'warning-outline' },
        { id: 'outro', label: 'Outro motivo', icon: 'ellipsis-horizontal' },
      ];
    }

    return [
      { id: 'erro_registro', label: 'Erro no registro', icon: 'bug-outline' },
      { id: 'saiu_cedo', label: 'Aluno saiu mais cedo', icon: 'exit-outline' },
      { id: 'nao_compareceu', label: 'Não compareceu de fato', icon: 'close-circle-outline' },
      { id: 'duplicado', label: 'Check-in duplicated', icon: 'copy-outline' },
      { id: 'outro', label: 'Outro motivo', icon: 'ellipsis-horizontal' },
    ];
  }

  async listarFaixas(): Promise<{ slug: string; nome: string; ordem: number }[]> {
    const rows = await this.databaseService.query<{
      slug: string;
      nome: string;
      ordem: number;
    }>(
      `SELECT slug, nome, ordem FROM faixas WHERE categoria = 'ADULTO' ORDER BY ordem ASC`,
    );
    return rows;
  }
}
