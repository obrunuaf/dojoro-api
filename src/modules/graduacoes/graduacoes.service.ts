import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateGraduacaoDto } from './dtos/create-graduacao.dto';
import { GraduacaoDto } from './dtos/graduacao.dto';
import { AptidaoDto } from './dtos/aptidao.dto';

interface GraduacaoRow {
  id: string;
  usuario_id: string;
  usuario_nome: string;
  academia_id: string;
  faixa_slug: string;
  grau: number;
  faixa_anterior_slug: string | null;
  grau_anterior: number | null;
  data_graduacao: string;
  professor_id: string;
  professor_nome: string;
  observacoes: string | null;
  aula_vinculada_id: string | null;
  status: string;
}

@Injectable()
export class GraduacoesService {
  constructor(private readonly db: DatabaseService) {}

  private readonly SELECT_GRADUACAO = `
    SELECT 
      g.id,
      g.usuario_id,
      u.nome_completo as usuario_nome,
      g.academia_id,
      g.faixa_slug,
      g.grau,
      g.faixa_anterior_slug,
      g.grau_anterior,
      g.data_graduacao,
      g.professor_id,
      p.nome_completo as professor_nome,
      g.observacoes,
      g.aula_vinculada_id,
      COALESCE(g.status, 'CONFIRMADA') as status
    FROM graduacoes g
    JOIN usuarios u ON u.id = g.usuario_id
    LEFT JOIN usuarios p ON p.id = g.professor_id
  `;

  /**
   * Lista todas as graduações de uma academia
   */
  async findAll(academiaId: string, filters?: {
    alunoId?: string;
    from?: string;
    to?: string;
    status?: string;
  }): Promise<GraduacaoDto[]> {
    let query = `${this.SELECT_GRADUACAO} WHERE g.academia_id = $1`;
    const params: any[] = [academiaId];
    let paramIndex = 2;

    if (filters?.alunoId) {
      query += ` AND g.usuario_id = $${paramIndex++}`;
      params.push(filters.alunoId);
    }
    if (filters?.from) {
      query += ` AND g.data_graduacao >= $${paramIndex++}`;
      params.push(filters.from);
    }
    if (filters?.to) {
      query += ` AND g.data_graduacao <= $${paramIndex++}`;
      params.push(filters.to);
    }
    if (filters?.status) {
      query += ` AND g.status = $${paramIndex++}`;
      params.push(filters.status);
    }

    query += ' ORDER BY g.data_graduacao DESC';

    const rows = await this.db.query<GraduacaoRow>(query, params);
    return rows.map(this.mapRowToDto);
  }

  /**
   * Busca uma graduação por ID
   */
  async findById(id: string): Promise<GraduacaoDto> {
    const row = await this.db.queryOne<GraduacaoRow>(
      `${this.SELECT_GRADUACAO} WHERE g.id = $1`, 
      [id]
    );

    if (!row) {
      throw new NotFoundException('Graduação não encontrada');
    }

    return this.mapRowToDto(row);
  }

  /**
   * Registra uma nova graduação
   */
  async criar(dto: CreateGraduacaoDto, academiaId: string): Promise<GraduacaoDto> {
    // Verifica se já existe graduação para mesma faixa/grau
    const existing = await this.db.queryOne(`
      SELECT id FROM graduacoes 
      WHERE usuario_id = $1 AND faixa_slug = $2 AND grau = $3 AND status != 'CANCELADA'
    `, [dto.alunoId, dto.faixaNova, dto.grauNovo]);

    if (existing) {
      throw new BadRequestException('Já existe uma graduação registrada para esta faixa e grau');
    }

    const row = await this.db.queryOne<GraduacaoRow>(`
      INSERT INTO graduacoes (
        id, usuario_id, academia_id, faixa_slug, grau,
        faixa_anterior_slug, grau_anterior, data_graduacao,
        professor_id, observacoes, aula_vinculada_id, status
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10, 'CONFIRMADA'
      )
      RETURNING *
    `, [
      dto.alunoId,
      academiaId,
      dto.faixaNova,
      dto.grauNovo,
      dto.faixaAnterior,
      dto.grauAnterior,
      dto.dataGraduacao,
      dto.professorId,
      dto.observacoes ?? null,
      dto.aulaVinculadaId ?? null,
    ]);

    // Atualiza a faixa/grau atual do aluno
    await this.atualizarFaixaAluno(dto.alunoId, dto.faixaNova, dto.grauNovo);

    return this.findById(row!.id);
  }

  /**
   * Confirma uma graduação pendente
   */
  async confirmar(id: string): Promise<GraduacaoDto> {
    const row = await this.db.queryOne<GraduacaoRow>(`
      UPDATE graduacoes 
      SET status = 'CONFIRMADA'
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (!row) {
      throw new NotFoundException('Graduação não encontrada');
    }

    // Atualiza faixa do aluno
    await this.atualizarFaixaAluno(row.usuario_id, row.faixa_slug, row.grau);

    return this.findById(id);
  }

  /**
   * Lista todos os alunos aptos para graduação na academia hoje
   * OTIMIZADO: Uma única query SQL em vez de N+1 queries
   */
  async findAptos(academiaId: string): Promise<AptidaoDto[]> {
    const rows = await this.db.query<{
      aluno_id: string;
      nome_completo: string;
      foto_url: string | null;
      faixa_atual_slug: string;
      grau_atual: number;
      graus_maximos: number;
      faixa_ordem: number;
      proxima_faixa_slug: string | null;
      aulas_minimas: number;
      tempo_minimo_meses: number;
      meta_aulas_no_grau: number;
      ultima_graduacao_data: string | null;
      ultima_troca_faixa_data: string | null;
      aulas_no_grau: string;
      aulas_na_faixa: string;
    }>(`
      WITH alunos_academia AS (
        SELECT 
          u.id as aluno_id,
          u.nome_completo,
          u.foto_url,
          u.faixa_atual_slug,
          u.grau_atual
        FROM usuarios u
        JOIN usuarios_papeis up ON up.usuario_id = u.id
        WHERE up.academia_id = $1 
          AND up.papel = 'ALUNO' 
          AND u.status = 'ACTIVE'
          AND u.faixa_atual_slug IS NOT NULL
      ),
      regras AS (
        SELECT 
          aa.aluno_id,
          COALESCE(rg.aulas_minimas, rgd.aulas_minimas, 100) as aulas_minimas,
          COALESCE(rg.tempo_minimo_meses, rgd.tempo_minimo_meses, 6) as tempo_minimo_meses,
          COALESCE(rg.meta_aulas_no_grau, rgd.meta_aulas_no_grau, 20) as meta_aulas_no_grau
        FROM alunos_academia aa
        LEFT JOIN regras_graduacao rg ON rg.academia_id = $1 AND rg.faixa_slug = aa.faixa_atual_slug
        LEFT JOIN regras_graduacao_default rgd ON rgd.faixa_slug = aa.faixa_atual_slug
      ),
      ultima_graduacao AS (
        SELECT DISTINCT ON (g.usuario_id) 
          g.usuario_id as aluno_id,
          g.data_graduacao
        FROM graduacoes g
        WHERE g.status = 'CONFIRMADA'
        ORDER BY g.usuario_id, g.data_graduacao DESC
      ),
      ultima_troca_faixa AS (
        SELECT DISTINCT ON (g.usuario_id)
          g.usuario_id as aluno_id,
          g.data_graduacao
        FROM graduacoes g
        JOIN alunos_academia aa ON aa.aluno_id = g.usuario_id AND aa.faixa_atual_slug = g.faixa_slug
        WHERE g.status = 'CONFIRMADA' AND g.grau = 0
        ORDER BY g.usuario_id, g.data_graduacao DESC
      ),
      contagem_aulas AS (
        SELECT 
          aa.aluno_id,
          COUNT(CASE WHEN a.data_inicio > COALESCE(ug.data_graduacao, '1900-01-01') THEN 1 END) as aulas_no_grau,
          COUNT(CASE WHEN a.data_inicio > COALESCE(utf.data_graduacao, '1900-01-01') THEN 1 END) as aulas_na_faixa
        FROM alunos_academia aa
        LEFT JOIN ultima_graduacao ug ON ug.aluno_id = aa.aluno_id
        LEFT JOIN ultima_troca_faixa utf ON utf.aluno_id = aa.aluno_id
        LEFT JOIN presencas p ON p.aluno_id = aa.aluno_id AND p.status = 'PRESENTE'
        LEFT JOIN aulas a ON a.id = p.aula_id
        GROUP BY aa.aluno_id
      )
      SELECT 
        aa.aluno_id,
        aa.nome_completo,
        aa.foto_url,
        aa.faixa_atual_slug,
        aa.grau_atual,
        f.graus_maximos,
        f.ordem as faixa_ordem,
        pf.slug as proxima_faixa_slug,
        r.aulas_minimas,
        r.tempo_minimo_meses,
        r.meta_aulas_no_grau,
        ug.data_graduacao as ultima_graduacao_data,
        utf.data_graduacao as ultima_troca_faixa_data,
        COALESCE(ca.aulas_no_grau, 0) as aulas_no_grau,
        COALESCE(ca.aulas_na_faixa, 0) as aulas_na_faixa
      FROM alunos_academia aa
      JOIN faixas f ON f.slug = aa.faixa_atual_slug
      LEFT JOIN faixas pf ON pf.ordem = f.ordem + 1
      JOIN regras r ON r.aluno_id = aa.aluno_id
      LEFT JOIN ultima_graduacao ug ON ug.aluno_id = aa.aluno_id
      LEFT JOIN ultima_troca_faixa utf ON utf.aluno_id = aa.aluno_id
      LEFT JOIN contagem_aulas ca ON ca.aluno_id = aa.aluno_id
    `, [academiaId]);

    const resultado: AptidaoDto[] = [];

    for (const row of rows) {
      const aulasNoGrau = parseInt(row.aulas_no_grau) || 0;
      const aulasNaFaixa = parseInt(row.aulas_na_faixa) || 0;
      const isNextBelt = row.grau_atual >= row.graus_maximos;
      const proximoPasso = isNextBelt ? 'FAIXA' : 'GRAU';

      // Calcular meses na faixa
      const dataInicioFaixa = row.ultima_troca_faixa_data 
        ? new Date(row.ultima_troca_faixa_data) 
        : new Date('1900-01-01');
      const mesesNaFaixa = Math.floor((Date.now() - dataInicioFaixa.getTime()) / (1000 * 60 * 60 * 24 * 30.44));

      // Calcular progresso real
      let progresso = 0;
      const motivos: string[] = [];

      if (proximoPasso === 'GRAU') {
        progresso = Math.min(100, (aulasNoGrau / Math.max(1, row.meta_aulas_no_grau)) * 100);
        if (aulasNoGrau < row.meta_aulas_no_grau) {
          motivos.push(`Faltam ${row.meta_aulas_no_grau - aulasNoGrau} aulas`);
        }
      } else {
        const progAulas = (aulasNaFaixa / Math.max(1, row.aulas_minimas)) * 100;
        const progTempo = (mesesNaFaixa / Math.max(1, row.tempo_minimo_meses)) * 100;
        progresso = Math.min(100, (progAulas + progTempo) / 2);
        
        if (aulasNaFaixa < row.aulas_minimas) {
          motivos.push(`Faltam ${row.aulas_minimas - aulasNaFaixa} aulas`);
        }
        if (mesesNaFaixa < row.tempo_minimo_meses) {
          motivos.push(`Faltam ${row.tempo_minimo_meses - mesesNaFaixa} meses`);
        }
      }

      // Determinar status: APTO (100%), PROXIMO (80%+), ou ignorar (<80%)
      let status: 'APTO' | 'PROXIMO' | 'BLOQUEADO';
      if (progresso >= 100) {
        status = 'APTO';
      } else if (progresso >= 80) {
        status = 'PROXIMO';
      } else {
        // Ignorar alunos com menos de 80% de progresso
        continue;
      }

      // Frequência semanal
      const milisegundosPorSemana = 1000 * 60 * 60 * 24 * 7;
      const semanasNaFaixa = Math.max(1, Math.ceil((Date.now() - dataInicioFaixa.getTime()) / milisegundosPorSemana));
      const frequenciaSemanal = Number((aulasNaFaixa / semanasNaFaixa).toFixed(1));

      resultado.push({
        alunoId: row.aluno_id,
        alunoNome: row.nome_completo,
        fotoUrl: row.foto_url ?? undefined,
        faixaAtual: row.faixa_atual_slug,
        grauAtual: row.grau_atual,
        proximoPasso: proximoPasso as 'GRAU' | 'FAIXA',
        faixaDestino: isNextBelt ? (row.proxima_faixa_slug ?? row.faixa_atual_slug) : row.faixa_atual_slug,
        grauDestino: isNextBelt ? 0 : row.grau_atual + 1,
        status,
        progressoPercentual: Math.round(progresso),
        motivos,
        metricas: {
          aulasNoGrau,
          metaAulasNoGrau: row.meta_aulas_no_grau,
          aulasNaFaixa,
          metaAulasNaFaixa: row.aulas_minimas,
          mesesNaFaixa,
          metaMesesNaFaixa: row.tempo_minimo_meses,
          frequenciaSemanal,
          metaFrequenciaSemanal: 0,
        },
      });
    }

    // Ordenar: APTO primeiro, depois PROXIMO por progresso decrescente
    resultado.sort((a, b) => {
      if (a.status === 'APTO' && b.status !== 'APTO') return -1;
      if (a.status !== 'APTO' && b.status === 'APTO') return 1;
      return b.progressoPercentual - a.progressoPercentual;
    });

    return resultado;
  }

  /**
   * Cancela uma graduação
   */
  async cancelar(id: string): Promise<void> {
    const result = await this.db.queryOne(`
      UPDATE graduacoes 
      SET status = 'CANCELADA'
      WHERE id = $1
      RETURNING id
    `, [id]);

    if (!result) {
      throw new NotFoundException('Graduação não encontrada');
    }
  }

  /**
   * Atualiza a faixa/grau atual do aluno na tabela usuarios
   */
  private async atualizarFaixaAluno(alunoId: string, faixa: string, grau: number): Promise<void> {
    await this.db.query(`
      UPDATE usuarios 
      SET faixa_atual_slug = $2, grau_atual = $3
      WHERE id = $1
    `, [alunoId, faixa, grau]);
  }

  /**
   * Verifica se o aluno está apto para a próxima graduação
   */
  async verificarAptidao(alunoId: string, academiaId: string): Promise<AptidaoDto> {
    const aluno = await this.db.queryOne<{
      nome_completo: string;
      foto_url: string | null;
      faixa_atual_slug: string;
      grau_atual: number;
      matricula_status: string | null;
    }>(
      `SELECT u.nome_completo, u.foto_url, u.faixa_atual_slug, u.grau_atual, m.status as matricula_status
       FROM usuarios u
       LEFT JOIN matriculas m ON m.usuario_id = u.id AND m.academia_id = $2
       WHERE u.id = $1`,
      [alunoId, academiaId]
    );

    if (!aluno) throw new NotFoundException('Aluno não encontrado');

    // Alunos sem faixa atribuída não podem ser avaliados
    if (!aluno.faixa_atual_slug) {
      throw new BadRequestException('Aluno não possui faixa atribuída');
    }

    let regras = await this.db.queryOne<{
      aulas_minimas: number;
      tempo_minimo_meses: number;
      meta_aulas_no_grau: number;
      frequencia_minima_semanal: number;
    }>(
      `SELECT far.aulas_minimas, far.tempo_minimo_meses, far.meta_aulas_no_grau, 
              COALESCE(far.frequencia_minima_semanal, 0) as frequencia_minima_semanal
       FROM regras_graduacao far 
       WHERE far.academia_id = $1 AND far.faixa_slug = $2`,
      [academiaId, aluno.faixa_atual_slug]
    );

    // [Fallback] Se não houver regra específica para a academia, buscar do template default
    if (!regras) {
      regras = await this.db.queryOne<{
        aulas_minimas: number;
        tempo_minimo_meses: number;
        meta_aulas_no_grau: number;
        frequencia_minima_semanal: number;
      }>(
        `SELECT aulas_minimas, tempo_minimo_meses, meta_aulas_no_grau, 0 as frequencia_minima_semanal
         FROM regras_graduacao_default 
         WHERE faixa_slug = $1`,
        [aluno.faixa_atual_slug]
      );
    }

    const faixaInfo = await this.db.queryOne<{
      ordem: number;
      graus_maximos: number;
    }>(
      'SELECT ordem, graus_maximos FROM faixas WHERE slug = $1',
      [aluno.faixa_atual_slug]
    );

    if (!regras || !faixaInfo) {
      throw new BadRequestException('Regras de graduação não configuradas para esta faixa (nem default encontrado)');
    }

    // Buscar data da última graduação
    const ultimaGrad = await this.db.queryOne<{ data_graduacao: string }>(
      `SELECT data_graduacao FROM graduacoes 
       WHERE usuario_id = $1 AND status = 'CONFIRMADA' 
       ORDER BY data_graduacao DESC LIMIT 1`,
      [alunoId]
    );

    // Contar aulas desde a última graduação (para o próximo grau)
    const aulasNoGrauRow = await this.db.queryOne<{ count: string }>(
      `SELECT count(*) FROM presencas p
       JOIN aulas a ON a.id = p.aula_id
       WHERE p.aluno_id = $1 AND p.status = 'PRESENTE' 
       AND a.data_inicio > $2`,
      [alunoId, ultimaGrad?.data_graduacao ?? '1900-01-01']
    );

    // Contar aulas desde a última troca de faixa (para a próxima faixa)
    const ultimaTrocaFaixa = await this.db.queryOne<{ data_graduacao: string }>(
      `SELECT data_graduacao FROM graduacoes 
       WHERE usuario_id = $1 AND faixa_slug = $2 AND grau = 0 AND status = 'CONFIRMADA'
       ORDER BY data_graduacao DESC LIMIT 1`,
      [alunoId, aluno.faixa_atual_slug]
    );

    const aulasNaFaixaRow = await this.db.queryOne<{ count: string }>(
      `SELECT count(*) FROM presencas p
       JOIN aulas a ON a.id = p.aula_id
       WHERE p.aluno_id = $1 AND p.status = 'PRESENTE' 
       AND a.data_inicio > $2`,
      [alunoId, ultimaTrocaFaixa?.data_graduacao ?? '1900-01-01']
    );

    const aulasNoGrau = parseInt(aulasNoGrauRow?.count ?? '0');
    const aulasNaFaixa = parseInt(aulasNaFaixaRow?.count ?? '0');

    // Calcular meses na faixa
    const dataInicioFaixa = ultimaTrocaFaixa ? new Date(ultimaTrocaFaixa.data_graduacao) : new Date('1900-01-01');
    const mesesNaFaixa = Math.floor((Date.now() - dataInicioFaixa.getTime()) / (1000 * 60 * 60 * 24 * 30.44));

    // Determinar próximo passo
    const isNextBelt = aluno.grau_atual >= faixaInfo.graus_maximos;
    const proximoPasso = isNextBelt ? 'FAIXA' : 'GRAU';

    let proximaFaixaSlug = aluno.faixa_atual_slug;
    let proximoGrau = aluno.grau_atual + 1;

    if (isNextBelt) {
      const proximaFaixa = await this.db.queryOne<{ slug: string }>(
        'SELECT slug FROM faixas WHERE ordem > $1 ORDER BY ordem ASC LIMIT 1',
        [faixaInfo.ordem]
      );
      proximaFaixaSlug = proximaFaixa?.slug ?? aluno.faixa_atual_slug;
      proximoGrau = 0;
    }

    // Avaliação de Aptidão
    const motivos: string[] = [];
    let status: 'APTO' | 'PROXIMO' | 'BLOQUEADO' = 'APTO';

    if (proximoPasso === 'GRAU') {
      if (aulasNoGrau < regras.meta_aulas_no_grau) {
        status = 'PROXIMO';
        motivos.push(`Faltam ${regras.meta_aulas_no_grau - aulasNoGrau} aulas para o próximo grau`);
      }
    } else {
      if (aulasNaFaixa < (regras.aulas_minimas || 0)) {
        status = 'PROXIMO';
        motivos.push(`Faltam ${(regras.aulas_minimas || 0) - aulasNaFaixa} aulas no total da faixa`);
      }
      if (mesesNaFaixa < (regras.tempo_minimo_meses || 0)) {
        status = 'PROXIMO';
        motivos.push(`Faltam ${(regras.tempo_minimo_meses || 0) - mesesNaFaixa} meses de permanência na faixa`);
      }
    }

    // Progresso Percentual
    let progresso = 0;
    if (proximoPasso === 'GRAU') {
      progresso = Math.min(100, (aulasNoGrau / regras.meta_aulas_no_grau) * 100);
    } else {
      const progAulas = (aulasNaFaixa / (regras.aulas_minimas || 1)) * 100;
      const progTempo = (mesesNaFaixa / (regras.tempo_minimo_meses || 1)) * 100;
      progresso = Math.min(100, (progAulas + progTempo) / 2);
    }

    // Calcular frequência semanal média (desde o início da faixa)
    const milisegundosPorSemana = 1000 * 60 * 60 * 24 * 7;
    const semanasNaFaixa = Math.max(1, Math.ceil((Date.now() - dataInicioFaixa.getTime()) / milisegundosPorSemana));
    const frequenciaSemanal = Number((aulasNaFaixa / semanasNaFaixa).toFixed(1));

    return {
      alunoId,
      alunoNome: aluno.nome_completo,
      fotoUrl: aluno.foto_url ?? undefined,
      matriculaStatus: aluno.matricula_status ?? undefined,
      faixaAtual: aluno.faixa_atual_slug,
      grauAtual: aluno.grau_atual,
      proximoPasso,
      faixaDestino: proximaFaixaSlug,
      grauDestino: proximoGrau,
      status,
      progressoPercentual: Math.round(progresso),
      motivos,
      metricas: {
        aulasNoGrau,
        metaAulasNoGrau: regras.meta_aulas_no_grau,
        aulasNaFaixa,
        metaAulasNaFaixa: regras.aulas_minimas,
        mesesNaFaixa,
        metaMesesNaFaixa: regras.tempo_minimo_meses,
        frequenciaSemanal,
        metaFrequenciaSemanal: Number(regras.frequencia_minima_semanal) || 0,
      },
    };
  }

  private mapRowToDto(row: GraduacaoRow): GraduacaoDto {
    return {
      id: row.id,
      alunoId: row.usuario_id,
      alunoNome: row.usuario_nome,
      faixaAnterior: row.faixa_anterior_slug ?? row.faixa_slug,
      grauAnterior: row.grau_anterior ?? 0,
      faixaNova: row.faixa_slug,
      grauNovo: row.grau,
      dataGraduacao: row.data_graduacao,
      professorId: row.professor_id,
      professorNome: row.professor_nome,
      observacoes: row.observacoes ?? undefined,
      aulaVinculadaId: row.aula_vinculada_id ?? undefined,
      status: row.status,
    };
  }
}
