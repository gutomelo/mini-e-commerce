import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LoginUseCase } from '../../application/auth/use-cases/login.use-case';
import { LogoutUseCase } from '../../application/auth/use-cases/logout.use-case';
import { RefreshTokensUseCase } from '../../application/auth/use-cases/refresh-tokens.use-case';
import { RegisterUserUseCase } from '../../application/auth/use-cases/register-user.use-case';
import { SingleResponse } from '../contracts';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
}

interface RegisteredUserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Auth endpoints get their own stricter throttle bucket (10 req/min) on
 * top of the global default, since they're the most valuable target for
 * credential-stuffing / brute-force traffic.
 */
@ApiTags('auth')
@Throttle({ auth: { limit: 10, ttl: 60_000 } })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokensUseCase: RefreshTokensUseCase,
    private readonly logoutUseCase: LogoutUseCase,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new customer account' })
  async register(@Body() dto: RegisterDto): Promise<SingleResponse<RegisteredUserResponse>> {
    const user = await this.registerUserUseCase.execute(dto);
    return { data: user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email/password and receive a token pair' })
  async login(@Body() dto: LoginDto): Promise<SingleResponse<TokenPairResponse>> {
    const tokens = await this.loginUseCase.execute(dto);
    return { data: tokens };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token for a new access/refresh token pair' })
  async refresh(@Body() dto: RefreshDto): Promise<SingleResponse<TokenPairResponse>> {
    const tokens = await this.refreshTokensUseCase.execute(dto);
    return { data: tokens };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the given refresh token' })
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.logoutUseCase.execute(dto);
  }
}
