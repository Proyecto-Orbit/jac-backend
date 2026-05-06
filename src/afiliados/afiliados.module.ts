import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Persona } from './entities/persona.entity';
import { Cargo } from './entities/cargo.entity';
import { PersonaCargo } from './entities/persona-cargo.entity';
import { PersonaJAC } from './entities/persona-jac.entity';
import { AfiliadosService } from './afiliados.service';
import { AfiliadosController } from './afiliados.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Persona, Cargo, PersonaCargo, PersonaJAC]),
  ],
  controllers: [AfiliadosController],
  providers: [AfiliadosService],
  exports: [AfiliadosService],
})
export class AfiliadosModule {}
