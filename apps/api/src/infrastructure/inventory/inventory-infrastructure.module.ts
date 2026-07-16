import { Module } from '@nestjs/common';
import { InventoryClient } from '../../application/ports/inventory-client.port';
import { HttpInventoryClient } from './http-inventory-client';

/**
 * Binds the {@link InventoryClient} port to the real HTTP adapter. Kept as
 * its own module (rather than folded into the presentation-layer
 * `InventoryModule`) so infrastructure wiring stays alongside the other
 * `infrastructure/*` modules and could be swapped for a test double
 * independently of the controller/use-case wiring.
 */
@Module({
  providers: [{ provide: InventoryClient, useClass: HttpInventoryClient }],
  exports: [InventoryClient],
})
export class InventoryInfrastructureModule {}
