import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Wireless Bluetooth Headphones' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({
    example: 'wireless-bluetooth-headphones',
    description: 'Lowercase, hyphen-separated slug',
  })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric characters separated by single hyphens',
  })
  slug!: string;

  @ApiProperty({ example: 'Over-ear headphones with active noise cancellation.' })
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty({ example: 12999, description: 'Price in integer cents' })
  @IsInt()
  @IsPositive()
  priceCents!: number;

  @ApiPropertyOptional({ example: 'https://placehold.co/600x400?text=Headphones' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  @IsUUID()
  categoryId!: string;
}
