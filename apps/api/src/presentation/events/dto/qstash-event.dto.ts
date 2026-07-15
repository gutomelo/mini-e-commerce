import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';

/**
 * Superset of `payment.completed`'s `{ orderId, paymentId, amountCents }`
 * and `payment.failed`'s `{ orderId, paymentId, reason }` — `orderId` is the
 * only field every accepted event actually needs; the rest are optional so
 * the strict `ValidationPipe` (`forbidNonWhitelisted: true`) doesn't reject
 * either shape.
 */
export class QStashEventDataDto {
  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  @IsUUID()
  orderId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  paymentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @IsPositive()
  amountCents?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Inbound envelope shape for `POST /events/qstash`. Only `payment.completed`
 * and `payment.failed` are accepted `event` values — enforced by the
 * controller, not by validation, since an unsupported value must yield a
 * `400` after signature verification rather than a generic validation error.
 */
export class QStashEventDto {
  @ApiProperty({ example: 'payment.completed' })
  @IsString()
  event!: string;

  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  @IsString()
  correlationId!: string;

  @ApiProperty({ example: '2026-07-15T12:00:00.000Z' })
  @IsString()
  timestamp!: string;

  @ApiProperty({ type: QStashEventDataDto })
  @ValidateNested()
  @Type(() => QStashEventDataDto)
  data!: QStashEventDataDto;
}
