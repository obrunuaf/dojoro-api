import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AcademiaStatusGuard } from '../guards/academia-status.guard';

/**
 * Combined decorator that applies:
 * 1. JwtAuthGuard - validates JWT token
 * 2. AcademiaStatusGuard - checks if academia is active
 * 3. RolesGuard - validates user roles
 * 
 * Use this instead of @UseGuards(JwtAuthGuard, RolesGuard)
 */
export const AuthGuards = () =>
  applyDecorators(UseGuards(JwtAuthGuard, AcademiaStatusGuard, RolesGuard));
