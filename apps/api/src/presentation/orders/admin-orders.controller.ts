import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetAnyOrderUseCase } from '../../application/orders/use-cases/get-any-order.use-case';
import { ListAllOrdersUseCase } from '../../application/orders/use-cases/list-all-orders.use-case';
import {
  AdminOrderOutput,
  AdminOrderSummaryOutput,
} from '../../application/orders/use-cases/order-output';
import { UserRole } from '../../domain/auth/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ListResponse, SingleResponse } from '../contracts';
import { AdminListOrdersQueryDto } from './dto/admin-list-orders-query.dto';

/**
 * ADMIN-only, cross-customer order review. Unlike `OrdersController`, these
 * routes are never scoped to the caller's own `userId` — they exist for the
 * admin panel's order-management screens (Phase 7), which need to see every
 * customer's orders. Status remains read-only here: it is driven exclusively
 * by the QStash payment-event consumer (Phase 6), never by this controller.
 */
@ApiTags('admin-orders')
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminOrdersController {
  constructor(
    private readonly listAllOrdersUseCase: ListAllOrdersUseCase,
    private readonly getAnyOrderUseCase: GetAnyOrderUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List orders across every customer, paginated and filterable by status (ADMIN only)',
  })
  async list(
    @Query() query: AdminListOrdersQueryDto,
  ): Promise<ListResponse<AdminOrderSummaryOutput>> {
    const { items, total, page, limit } = await this.listAllOrdersUseCase.execute(query);
    return {
      data: items,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: "Get any customer's order with line items (ADMIN only)" })
  async getOne(@Param('id', ParseUUIDPipe) id: string): Promise<SingleResponse<AdminOrderOutput>> {
    const order = await this.getAnyOrderUseCase.execute(id);
    return { data: order };
  }
}
