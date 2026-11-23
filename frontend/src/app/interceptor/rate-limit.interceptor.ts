import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastrService } from '../services/toast.service';

export const rateLimitInterceptor: HttpInterceptorFn = (req, next) => {
  const toaster = inject(ToastrService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 429) {
        toaster.error(
          'Foram feitas muitas requisições. Aguarde um pouco e tente novamente.',
          'Muitas requisições',
          { timeOut: 6000 },
        );
      }

      return throwError(() => error);
    }),
  );
};
