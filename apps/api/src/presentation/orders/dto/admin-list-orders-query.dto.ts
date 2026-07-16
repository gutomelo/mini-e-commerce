import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';
import type { OrderStatus } from '../../../domain/orders/order.entity';

const ORDER_STATUS_VALUES = ['PLACED', 'PAID', 'PAYMENT_FAILED'] as const;

/**
 * Query parameters for `GET /admin/orders`. Modeled on `ListOrdersQueryDto`,
 * plus an optional `status` filter restricted to the `OrderStatus` enum
 * values — an unrecognized value is rejected with `400` by the global
 * `ValidationPipe` here, before it ever reaches `ListAllOrdersUseCase` or
 * `PrismaOrderRepository`.
 */
export class AdminListOrdersQueryDto {
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

  @ApiPropertyOptional({ enum: ORDER_STATUS_VALUES })
  @IsOptional()
  @IsEnum(ORDER_STATUS_VALUES)
  status?: OrderStatus;
}
