import type { SerialPlate, PlatePatch, PlateSettings, SerialPlateBatchFields } from '../interface/serial-plates.interface';
import { FIELD_LABELS } from '../config/serial-plates.config';

export class SerialPlatesDomainService {
  public hasEquipmentData(record: PlatePatch): boolean {
    return [record.client, record.description, record.capacity, record.voltage, record.weight].some(value => value !== '' && value !== null && value !== undefined);
  }

  public selectRange(selected: ReadonlySet<string>, visible: readonly string[], anchor: string | null, target: string, checked: boolean, shift: boolean): Set<string> {
    const result = new Set(selected);
    const start = anchor === null ? -1 : visible.indexOf(anchor);
    const end = visible.indexOf(target);
    const values = shift && start >= 0 && end >= 0 ? visible.slice(Math.min(start, end), Math.max(start, end) + 1) : [target];
    values.forEach(serial => checked ? result.add(serial) : result.delete(serial));

    return result;
  }

  public manufacturingLabel(value: string): string {
    const [year, month] = value.split('-').map(Number);
    if (!year || !month || month > 12 || month < 1) return 'Não informado';

    return new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1))).toLocaleUpperCase('pt-BR') + '/' + year;
  }

  public reportMissing(records: SerialPlate[], settings: PlateSettings): string[] {
    const missing: string[] = [];

    if (!settings.crea.trim()) missing.push('Informe o CREA nas configurações.');

    records.forEach(row => {
      const fields = [!row.description.trim() && 'modelo',
      !row.voltage.trim() && 'tensão', !(row.weight !== null && row.weight > 0) && 'peso',
      !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(row.manufactured) && 'data de fabricação'].filter(Boolean);

      if (fields.length) missing.push(`${row.serial}: ${fields.join(', ')}.`);
    });

    return missing;
  }

  public editPatch(edit: SerialPlate): PlatePatch {
    const patch: PlatePatch = Object.fromEntries(Object.keys(FIELD_LABELS).map(key => [key, edit[key as keyof SerialPlate]]));
    patch.order = patch.readyStock ? '' : patch.order?.trim();
    patch.of = patch.of?.trim();

    if (!patch.order) patch.orderItem = '';
    if (patch.readyStock) patch.client = '';

    return patch;
  }

  public batchPatch(batch: PlatePatch, fields: SerialPlateBatchFields): PlatePatch {
    const patch: PlatePatch = {};

    for (const key of Object.keys(fields) as (keyof SerialPlateBatchFields)[]) {
      if (fields[key]) Object.assign(patch, { [key]: batch[key] ?? (key === 'readyStock' ? false : key === 'weight' ? null : '') });
    }

    if (fields.order) patch.orderItem = batch.orderItem ?? '';

    if (patch.readyStock === true) {
      patch.order = '';
      patch.orderItem = '';
      patch.client = '';
    }

    return patch;
  }

}
