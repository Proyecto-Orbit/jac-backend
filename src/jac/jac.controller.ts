import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { JacService } from './jac.service';
import { CreateJACDto } from './dto/create-jac.dto';
import { UpdateJACDto } from './dto/update-jac.dto';
import { JACResponseDto } from './dto/jac-response.dto';
import { Auth } from '../auth/auth.decorator';
import { Role } from '../auth/role.enum';

@Controller('jac')
export class JacController {
  constructor(private readonly jacService: JacService) {}

  @Auth(Role.ADMIN)
  @Post()
  create(@Body() createJACDto: CreateJACDto): Promise<JACResponseDto> {
    return this.jacService.create(createJACDto);
  }

  @Auth(Role.ADMIN)
  @Get()
  findAll(): Promise<JACResponseDto[]> {
    return this.jacService.findAll();
  }

  @Auth(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<JACResponseDto> {
    return this.jacService.findOne(id);
  }

  @Auth(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateJACDto: UpdateJACDto,
  ): Promise<JACResponseDto> {
    return this.jacService.update(id, updateJACDto);
  }

  @Auth(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    return this.jacService.remove(id);
  }
}
