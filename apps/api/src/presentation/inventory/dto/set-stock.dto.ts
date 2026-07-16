import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class SetStockDto {
  @ApiProperty({ example: 20, description: 'Absolute stock quantity (non-negative integer)' })
  @IsInt()
  @Min(0)
  quantity!: number;
}
