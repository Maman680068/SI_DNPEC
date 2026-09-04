import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';

/** Uniformise la forme JSON des erreurs HTTP renvoyées par l'API. */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();

    response
      .status(status)
      .json(typeof body === 'string' ? { statusCode: status, message: body } : { statusCode: status, ...body });
  }
}
