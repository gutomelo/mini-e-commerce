import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

interface HealthResponse {
  status: string;
  service: string;
}

// Stays at `/api/health`, outside URI versioning, so existing monitoring
// and the compose healthcheck keep working unchanged.
@ApiExcludeController()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok', service: 'api' };
  }
}
