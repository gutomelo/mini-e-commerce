import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString, Matches, Min } from 'class-validator';

const SORT_PATTERN = /^(createdAt|price):(asc|desc)$/;

/**
 * Query parameters for `GET /products`. All fields are optional; numeric
 * strings are transformed to numbers by the global `ValidationPipe`
 * (`transform: true`). Final clamping/defaulting (page >= 1, limit in
 * [1, 100]) happens in `ListProductsUseCase`, not here — this DTO only
 * rejects clearly malformed input.
 *
 * `minPrice`/`maxPrice` are expressed in integer cents, matching how
 * `Product.priceCents` is stored (e.g. `minPrice=1000` means $10.00).
 * `sort` follows the `<field>:<direction>` convention, e.g. `price:asc`,
 * `createdAt:desc` (default when omitted).
 */
export class ListProductsQueryDto {
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

  @ApiPropertyOptional({ example: 'headphones' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'electronics', description: 'Category slug' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 1000, description: 'Minimum price in integer cents' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 50000, description: 'Maximum price in integer cents' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    example: 'createdAt:desc',
    description: '`<field>:<direction>`, field in {createdAt, price}, direction in {asc, desc}',
  })
  @IsOptional()
  @Matches(SORT_PATTERN, { message: 'sort must match "<createdAt|price>:<asc|desc>"' })
  sort?: string;
}
