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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateProductUseCase } from '../../application/products/use-cases/create-product.use-case';
import { DeleteProductUseCase } from '../../application/products/use-cases/delete-product.use-case';
import { GetProductUseCase } from '../../application/products/use-cases/get-product.use-case';
import { ListProductsUseCase } from '../../application/products/use-cases/list-products.use-case';
import { ProductOutput } from '../../application/products/use-cases/product-output';
import { UpdateProductUseCase } from '../../application/products/use-cases/update-product.use-case';
import { UserRole } from '../../domain/auth/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ListResponse, SingleResponse } from '../contracts';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly listProductsUseCase: ListProductsUseCase,
    private readonly getProductUseCase: GetProductUseCase,
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly deleteProductUseCase: DeleteProductUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List products (public, cached, paginated, filterable)' })
  async list(@Query() query: ListProductsQueryDto): Promise<ListResponse<ProductOutput>> {
    const { items, total, page, limit } = await this.listProductsUseCase.execute(query);
    return {
      data: items,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get a product by id or slug (public, cached)' })
  async getOne(@Param('idOrSlug') idOrSlug: string): Promise<SingleResponse<ProductOutput>> {
    const product = await this.getProductUseCase.execute(idOrSlug);
    return { data: product };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product (ADMIN only)' })
  async create(@Body() dto: CreateProductDto): Promise<SingleResponse<ProductOutput>> {
    const product = await this.createProductUseCase.execute(dto);
    return { data: product };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product (ADMIN only)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<SingleResponse<ProductOutput>> {
    const product = await this.updateProductUseCase.execute(id, dto);
    return { data: product };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft-delete a product (ADMIN only)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.deleteProductUseCase.execute(id);
  }
}
