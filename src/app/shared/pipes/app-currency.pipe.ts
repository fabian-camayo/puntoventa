import { Pipe, PipeTransform } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import {
  DEFAULT_CURRENCY_CODE,
  DEFAULT_CURRENCY_LOCALE,
} from '@puntoventa/shared';

@Pipe({
  name: 'appCurrency',
  standalone: true,
})
export class AppCurrencyPipe implements PipeTransform {
  private readonly currencyPipe = new CurrencyPipe(DEFAULT_CURRENCY_LOCALE);

  transform(
    value: number | null | undefined,
    digits: string = '1.0-0',
  ): string | null {
    if (value == null || Number.isNaN(value)) {
      return null;
    }

    return this.currencyPipe.transform(
      value,
      DEFAULT_CURRENCY_CODE,
      'symbol',
      digits,
    );
  }
}
