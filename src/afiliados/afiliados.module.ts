import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Persona } from './entities/persona.entity';
import { Cargo } from './entities/cargo.entity';
import { PersonaCargo } from './entities/persona-cargo.entity';
import { PersonaJAC } from './entities/persona-jac.entity';
import { JAC } from '../jac/entities/jac.entity';
import { AfiliadosService } from './afiliados.service';
import { AfiliadosController } from './afiliados.controller';
import { ImportarAfiliadosService } from './importar/importar-afiliados.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Persona, Cargo, PersonaCargo, PersonaJAC, JAC]),
  ],
  controllers: [AfiliadosController],
  providers: [AfiliadosService, ImportarAfiliadosService],
  exports: [AfiliadosService],
})
export class AfiliadosModule {}
