import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AcademiaController } from './academia.controller';
import { AcademiaService } from './academia.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AcademiaController],
  providers: [AcademiaService],
  exports: [AcademiaService],
})
export class AcademiaModule {}
