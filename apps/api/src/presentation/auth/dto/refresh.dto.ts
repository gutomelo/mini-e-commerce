import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'The refresh token issued by login or a previous refresh call.' })
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}
