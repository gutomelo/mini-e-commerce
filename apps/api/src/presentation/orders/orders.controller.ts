import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateOrderUseCase } from '../../application/orders/use-cases/create-order.use-case';
import { GetOrderUseCase } from '../../application/orders/use-cases/get-order.use-case';
import { ListOrdersUseCase } from '../../application/orders/use-cases/list-orders.use-case';
import { OrderOutput, OrderSummaryOutput } from '../../application/orders/use-cases/order-output';
import type { AccessTokenPayload } from '../../application/auth/ports/token-service.port';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ListResponse, SingleResponse } from '../contracts';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly listOrdersUseCase: ListOrdersUseCase,
    private readonly getOrderUseCase: GetOrderUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Place an order for the authenticated user' })
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateOrderDto,
  ): Promise<SingleResponse<OrderOutput>> {
    const order = await this.createOrderUseCase.execute({ userId: user.sub, items: dto.items });
    return { data: order };
  }

  @Get()
  @ApiOperation({ summary: "List the authenticated user's own orders (paginated)" })
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListOrdersQueryDto,
  ): Promise<ListResponse<OrderSummaryOutput>> {
    const { items, total, page, limit } = await this.listOrdersUseCase.execute(user.sub, query);
    return {
      data: items,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: "Get one of the authenticated user's own orders with line items" })
  async getOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SingleResponse<OrderOutput>> {
    const order = await this.getOrderUseCase.execute(id, user.sub);
    return { data: order };
  }
}
