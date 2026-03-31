export function hasExpectedFeeUpdateTransition({
  oldFeeMist,
  newFeeMist,
  registerFeeMist,
  updatedFeeMist
}: {
  oldFeeMist: bigint;
  newFeeMist: bigint;
  registerFeeMist: bigint;
  updatedFeeMist: bigint;
}) {
  if (newFeeMist !== updatedFeeMist) {
    return false;
  }

  return oldFeeMist === registerFeeMist || oldFeeMist === updatedFeeMist;
}
