import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Electronics' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'electronics', description: 'Lowercase, hyphen-separated slug' })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric characters separated by single hyphens',
  })
  slug!: string;
}
