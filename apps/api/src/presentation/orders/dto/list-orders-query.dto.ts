import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

/**
 * Query parameters for `GET /orders`. Both fields are optional; numeric
 * strings are transformed to numbers by the global `ValidationPipe`
 * (`transform: true`). Final clamping/defaulting (page >= 1, limit in
 * [1, 100]) happens in `ListOrdersUseCase`, not here.
 */
export class ListOrdersQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number;
}
