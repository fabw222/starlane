import { Transaction } from "@mysten/sui/transactions";

const SUI_CLOCK_OBJECT_ID = "0x6";

export function buildRegisterGateTransaction({
  packageId,
  worldPackageId,
  tollRegistryId,
  gateId,
  characterId,
  ownerCapRef,
  feeMist,
  recipient
}: {
  packageId: string;
  worldPackageId: string;
  tollRegistryId: string;
  gateId: string;
  characterId: string;
  ownerCapRef: { objectId: string; version: string | number; digest: string };
  feeMist: bigint;
  recipient: string;
}) {
  const tx = new Transaction();

  // Borrow OwnerCap<Gate> from Character
  const [ownerCap, receipt] = tx.moveCall({
    target: `${worldPackageId}::character::borrow_owner_cap`,
    typeArguments: [`${worldPackageId}::gate::Gate`],
    arguments: [
      tx.object(characterId),
      tx.receivingRef(ownerCapRef),
    ],
  });

  // Register gate with borrowed OwnerCap
  const cap = tx.moveCall({
    target: `${packageId}::toll_gate::register_gate`,
    arguments: [
      tx.object(tollRegistryId),
      tx.object(gateId),
      ownerCap,
      tx.pure.u64(feeMist)
    ]
  });

  // Return OwnerCap to Character
  tx.moveCall({
    target: `${worldPackageId}::character::return_owner_cap`,
    typeArguments: [`${worldPackageId}::gate::Gate`],
    arguments: [
      tx.object(characterId),
      ownerCap,
      receipt,
    ],
  });

  tx.transferObjects([cap], tx.pure.address(recipient));
  return tx;
}

export function buildUpdateFeeTransaction({
  packageId,
  tollRegistryId,
  operatorCapId,
  feeMist
}: {
  packageId: string;
  tollRegistryId: string;
  operatorCapId: string;
  feeMist: bigint;
}) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::toll_gate::update_toll_fee`,
    arguments: [tx.object(tollRegistryId), tx.object(operatorCapId), tx.pure.u64(feeMist)]
  });
  return tx;
}

export function buildWithdrawRevenueTransaction({
  packageId,
  tollRegistryId,
  operatorCapId,
  recipient
}: {
  packageId: string;
  tollRegistryId: string;
  operatorCapId: string;
  recipient: string;
}) {
  const tx = new Transaction();
  const payout = tx.moveCall({
    target: `${packageId}::toll_gate::withdraw_revenue`,
    arguments: [tx.object(tollRegistryId), tx.object(operatorCapId)]
  });
  tx.transferObjects([payout], tx.pure.address(recipient));
  return tx;
}

export function buildBuyJumpPermitTransaction({
  packageId,
  tollRegistryId,
  sourceGateId,
  destinationGateId,
  characterId,
  feeMist,
  recipient
}: {
  packageId: string;
  tollRegistryId: string;
  sourceGateId: string;
  destinationGateId: string;
  characterId: string;
  feeMist: bigint;
  recipient: string;
}) {
  const tx = new Transaction();
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(feeMist)]);
  // buy_jump_permit returns only the change coin.
  // The JumpPermit is auto-transferred to the character's address by the contract.
  const change = tx.moveCall({
    target: `${packageId}::toll_gate::buy_jump_permit`,
    arguments: [
      tx.object(tollRegistryId),
      tx.object(sourceGateId),
      tx.object(destinationGateId),
      tx.object(characterId),
      payment,
      tx.object(SUI_CLOCK_OBJECT_ID)
    ]
  });
  tx.transferObjects([change], tx.pure.address(recipient));
  return tx;
}

export function buildCreateGateTransaction({
  worldPackageId,
  operator
}: {
  worldPackageId: string;
  operator: string;
}) {
  const tx = new Transaction();
  const [gate, ownerCap] = tx.moveCall({
    target: `${worldPackageId}::gate::create_gate_and_cap`,
    arguments: []
  });
  tx.moveCall({
    target: `${worldPackageId}::gate::share_gate`,
    arguments: [gate]
  });
  tx.transferObjects([ownerCap], tx.pure.address(operator));
  return tx;
}

export function buildCreateCharacterTransaction({
  worldPackageId,
  owner,
  callsign
}: {
  worldPackageId: string;
  owner: string;
  callsign: string;
}) {
  const tx = new Transaction();
  const character = tx.moveCall({
    target: `${worldPackageId}::character::new`,
    arguments: [tx.pure.address(owner), tx.pure.string(callsign)]
  });
  tx.transferObjects([character], tx.pure.address(owner));
  return tx;
}
