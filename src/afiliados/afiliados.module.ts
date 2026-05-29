import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Persona } from './entities/persona.entity';
import { Cargo } from './entities/cargo.entity';
import { JAC } from '../jac/entities/jac.entity';
import { AfiliadosService } from './afiliados.service';
import { AfiliadosController } from './afiliados.controller';
import { ImportarAfiliadosService } from './importar/importar-afiliados.service';

@Module({
  imports: [TypeOrmModule.forFeature([Persona, Cargo, JAC])],
  controllers: [AfiliadosController],
  providers: [AfiliadosService, ImportarAfiliadosService],
  exports: [AfiliadosService],
})
export class AfiliadosModule {}
