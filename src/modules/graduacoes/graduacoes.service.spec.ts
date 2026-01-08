import { Test, TestingModule } from '@nestjs/testing';
import { GraduacoesService } from './graduacoes.service';
import { DatabaseService } from '../../database/database.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('GraduacoesService', () => {
  let service: GraduacoesService;
  let db: DatabaseService;

  const mockDb = {
    query: jest.fn(),
    queryOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraduacoesService,
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<GraduacoesService>(GraduacoesService);
    db = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verificarAptidao', () => {
    const academiaId = 'acad-1';
    const alunoId = 'aluno-1';

    it('deve retornar APTO quando atingir meta de aulas de grau', async () => {
      // Mock Aluno
      mockDb.queryOne.mockResolvedValueOnce({ faixa_atual_slug: 'branca', grau_atual: 0 });
      // Mock Regras (Branca: 30 aulas/grau)
      mockDb.queryOne.mockResolvedValueOnce({ 
        aulas_minimas: 120, 
        tempo_minimo_meses: 12, 
        meta_aulas_no_grau: 30,
        frequencia_minima_semanal: 0 
      });
      // Mock Faixa info
      mockDb.queryOne.mockResolvedValueOnce({ ordem: 1, graus_maximos: 4 });
      // Mock Ultima Grad
      mockDb.queryOne.mockResolvedValueOnce({ data_graduacao: '2025-10-01' });
      // Mock Aulas no Grau (35 aulas > 30 meta)
      mockDb.queryOne.mockResolvedValueOnce({ count: '35' });
      // Mock Ultima Troca Faixa
      mockDb.queryOne.mockResolvedValueOnce({ data_graduacao: '2025-01-01' });
      // Mock Aulas na Faixa
      mockDb.queryOne.mockResolvedValueOnce({ count: '35' });

      const result = await service.verificarAptidao(alunoId, academiaId);

      expect(result.status).toBe('APTO');
      expect(result.proximoPasso).toBe('GRAU');
      expect(result.progressoPercentual).toBe(100);
    });

    it('deve retornar PROXIMO quando não atingir meta de aulas de grau', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ faixa_atual_slug: 'branca', grau_atual: 0 });
      mockDb.queryOne.mockResolvedValueOnce({ 
        aulas_minimas: 120, 
        tempo_minimo_meses: 12, 
        meta_aulas_no_grau: 30,
        frequencia_minima_semanal: 0 
      });
      mockDb.queryOne.mockResolvedValueOnce({ ordem: 1, graus_maximos: 4 });
      mockDb.queryOne.mockResolvedValueOnce({ data_graduacao: '2025-12-01' });
      mockDb.queryOne.mockResolvedValueOnce({ count: '15' }); // 15 < 30 meta
      mockDb.queryOne.mockResolvedValueOnce({ data_graduacao: '2025-12-01' });
      mockDb.queryOne.mockResolvedValueOnce({ count: '15' });

      const result = await service.verificarAptidao(alunoId, academiaId);

      expect(result.status).toBe('PROXIMO');
      expect(result.progressoPercentual).toBe(50);
      expect(result.motivos).toContain('Faltam 15 aulas para o próximo grau');
    });

    it('deve detectar mudança de faixa quando grau atual é o máximo', async () => {
      // Aluno branca 4 graus
      mockDb.queryOne.mockResolvedValueOnce({ faixa_atual_slug: 'branca', grau_atual: 4 });
      mockDb.queryOne.mockResolvedValueOnce({ 
        aulas_minimas: 120, 
        tempo_minimo_meses: 12, 
        meta_aulas_no_grau: 30,
        frequencia_minima_semanal: 0 
      });
      mockDb.queryOne.mockResolvedValueOnce({ ordem: 1, graus_maximos: 4 });
      mockDb.queryOne.mockResolvedValueOnce({ data_graduacao: '2025-12-01' });
      mockDb.queryOne.mockResolvedValueOnce({ count: '10' }); // aulas desde 4º grau
      mockDb.queryOne.mockResolvedValueOnce({ data_graduacao: '2025-01-01' }); // Entrou na branca há 1 ano
      mockDb.queryOne.mockResolvedValueOnce({ count: '130' }); // 130 aulas na faixa > 120 meta

      // Mock busca próxima faixa (ordem > 1)
      mockDb.queryOne.mockResolvedValueOnce({ slug: 'azul' });

      const result = await service.verificarAptidao(alunoId, academiaId);

      expect(result.proximoPasso).toBe('FAIXA');
      expect(result.faixaDestino).toBe('azul');
      expect(result.grauDestino).toBe(0);
      expect(result.status).toBe('APTO');
    });

    it('deve erro se regras não existirem', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ faixa_atual_slug: 'translucida', grau_atual: 0 });
      mockDb.queryOne.mockResolvedValueOnce(null); // regras null

      await expect(service.verificarAptidao(alunoId, academiaId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAptos', () => {
    it('deve retornar apenas alunos que estão APTO', async () => {
      const academiaId = 'acad-1';
      // Mock 2 alunos na academia
      mockDb.query.mockResolvedValueOnce([{ id: 'aluno-apto' }, { id: 'aluno-pendente' }]);

      // Mock verificarAptidao para cada um
      // Aluno 1: APTO
      jest.spyOn(service, 'verificarAptidao').mockResolvedValueOnce({
        alunoId: 'aluno-apto',
        status: 'APTO',
      } as any);

      // Aluno 2: PROXIMO
      jest.spyOn(service, 'verificarAptidao').mockResolvedValueOnce({
        alunoId: 'aluno-pendente',
        status: 'PROXIMO',
      } as any);

      const result = await service.findAptos(academiaId);

      expect(result).toHaveLength(1);
      expect(result[0].alunoId).toBe('aluno-apto');
    });
  });
});
