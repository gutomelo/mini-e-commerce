import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  GetProfileUseCase,
  ProfileOutput,
} from '../../application/users/use-cases/get-profile.use-case';
import type { AccessTokenPayload } from '../../application/auth/ports/token-service.port';
import { SingleResponse } from '../contracts';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly getProfileUseCase: GetProfileUseCase) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the authenticated user's profile" })
  async getProfile(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<SingleResponse<ProfileOutput>> {
    const profile = await this.getProfileUseCase.execute(user.sub);
    return { data: profile };
  }
}
