export type ApplianceDraftRow = { id: string; quantity: string };

export function addOrIncrementAppliance<T extends ApplianceDraftRow>(rows: T[], appliance: T): T[] {
  const existing = rows.find((row) => row.id === appliance.id);
  if (!existing) return [...rows, appliance];

  const quantity = Number(existing.quantity);
  if (Number.isInteger(quantity) && quantity >= 999) return rows;
  const nextQuantity = Number.isInteger(quantity) && quantity > 0 ? quantity + 1 : 1;
  return rows.map((row) => row.id === appliance.id ? { ...row, quantity: String(nextQuantity) } : row);
}

export function decrementAppliance<T extends ApplianceDraftRow>(rows: T[], id: string): T[] {
  return rows.flatMap((row) => {
    if (row.id !== id) return [row];
    const quantity = Number(row.quantity);
    return Number.isInteger(quantity) && quantity > 1 ? [{ ...row, quantity: String(quantity - 1) }] : [];
  });
}

export function removeAppliance<T extends Pick<ApplianceDraftRow, "id">>(rows: T[], id: string): T[] {
  return rows.filter((row) => row.id !== id);
}
