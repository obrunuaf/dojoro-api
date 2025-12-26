import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AulasController } from './aulas.controller';
import { AulasService } from './aulas.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AulasController],
  providers: [AulasService],
  exports: [AulasService],
})
export class AulasModule {}

