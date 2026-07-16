import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateCategoryUseCase } from '../../application/categories/use-cases/create-category.use-case';
import { DeleteCategoryUseCase } from '../../application/categories/use-cases/delete-category.use-case';
import {
  CategoryOutput,
  ListCategoriesUseCase,
} from '../../application/categories/use-cases/list-categories.use-case';
import { UpdateCategoryUseCase } from '../../application/categories/use-cases/update-category.use-case';
import { UserRole } from '../../domain/auth/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ListResponse, SingleResponse } from '../contracts';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly listCategoriesUseCase: ListCategoriesUseCase,
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
    private readonly deleteCategoryUseCase: DeleteCategoryUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all categories (public, cached)' })
  async list(): Promise<ListResponse<CategoryOutput>> {
    const categories = await this.listCategoriesUseCase.execute();
    const total = categories.length;
    return {
      data: categories,
      meta: { page: 1, limit: total, total, totalPages: 1 },
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a category (ADMIN only)' })
  async create(@Body() dto: CreateCategoryDto): Promise<SingleResponse<CategoryOutput>> {
    const category = await this.createCategoryUseCase.execute(dto);
    return { data: category };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a category (ADMIN only)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<SingleResponse<CategoryOutput>> {
    const category = await this.updateCategoryUseCase.execute(id, dto);
    return { data: category };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a category (ADMIN only)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.deleteCategoryUseCase.execute(id);
  }
}
