import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StockInfo } from '../../application/ports/inventory-client.port';
import { GetStockUseCase } from '../../application/inventory/use-cases/get-stock.use-case';
import { SetStockUseCase } from '../../application/inventory/use-cases/set-stock.use-case';
import { UserRole } from '../../domain/auth/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SingleResponse } from '../contracts';
import { SetStockDto } from './dto/set-stock.dto';

/**
 * Admin-only proxy to `apps/inventory`'s stock read/write contract.
 * `apps/api` is the sole authenticated caller of `apps/inventory` — no
 * frontend ever reaches it directly, per the project's Service-Oriented
 * Architecture rule.
 */
@ApiTags('inventory')
@ApiBearerAuth()
@Controller('admin/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class InventoryController {
  constructor(
    private readonly getStockUseCase: GetStockUseCase,
    private readonly setStockUseCase: SetStockUseCase,
  ) {}

  @Get(':productId')
  @ApiOperation({ summary: "Look up a product's stock quantity (ADMIN only)" })
  async getStock(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<SingleResponse<StockInfo>> {
    const stock = await this.getStockUseCase.execute(productId);
    return { data: stock };
  }

  @Patch(':productId')
  @ApiOperation({ summary: "Set a product's stock quantity (ADMIN only)" })
  async setStock(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: SetStockDto,
  ): Promise<SingleResponse<StockInfo>> {
    const stock = await this.setStockUseCase.execute(productId, dto.quantity);
    return { data: stock };
  }
}
