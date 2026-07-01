import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message =
      exception instanceof HttpException
        ? this.extractMessage(exception)
        : 'Error interno del servidor';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaError = this.mapPrismaError(exception);
      status = prismaError.status;
      message = prismaError.message;
    }

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json({
      success: false,
      message,
      statusCode: status,
      timestamp: new Date().toISOString(),
    });
  }

  private extractMessage(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === 'string') return response;

    if (typeof response === 'object' && response !== null) {
      const body = response as { message?: string | string[] };
      if (Array.isArray(body.message)) {
        return body.message.join('; ');
      }
      if (typeof body.message === 'string') {
        return body.message;
      }
    }

    return exception.message;
  }

  private mapPrismaError(
    error: Prisma.PrismaClientKnownRequestError,
  ): { status: number; message: string } {
    if (error.code === 'P2003') {
      const constraint = error.meta?.['constraint'];
      const field = String(constraint ?? error.meta?.['field_name'] ?? '');

      if (field.includes('user_id')) {
        return {
          status: HttpStatus.UNAUTHORIZED,
          message: 'Sesión inválida. Cierre sesión e inicie nuevamente.',
        };
      }

      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Referencia de datos no válida. Verifique la información e intente de nuevo.',
      };
    }

    if (error.code === 'P2025') {
      return {
        status: HttpStatus.NOT_FOUND,
        message: 'Registro no encontrado.',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error de base de datos.',
    };
  }
}
