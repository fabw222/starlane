module starlane::toll_gate;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::event;
use sui::table::{Self, Table};
use sui::clock::Clock;
use world::access::{Self, OwnerCap};
use world::character::Character;
use world::gate::{Self, Gate};

const E_GATE_EXISTS: u64 = 0;
const E_GATE_NOT_FOUND: u64 = 1;
const E_INVALID_PAYMENT: u64 = 2;
const E_NOT_GATE_OWNER: u64 = 3;
const E_NOT_OPERATOR: u64 = 4;
const E_INVALID_FEE: u64 = 5;

const PROTOCOL_FEE_BPS: u64 = 100;
const BPS_DENOMINATOR: u64 = 10_000;
const PERMIT_DURATION_MS: u64 = 86_400_000; // 24 hours

/// Typed witness for the EVE Frontier gate extension pattern.
/// Authorizes StarLane to issue jump permits on configured gates.
public struct TollAuth has drop {}

public struct TollRegistry has key {
    id: UID,
    protocol_balance: Balance<SUI>,
    entries: Table<ID, TollEntry>,
}

public struct TollEntry has store {
    gate_id: ID,
    fee_mist: u64,
    operator: address,
    revenue_balance: Balance<SUI>,
}

public struct OperatorCap has key, store {
    id: UID,
    gate_id: ID,
    operator: address,
}

public struct ProtocolAdmin has key, store {
    id: UID,
}

public struct TollConfiguredEvent has copy, drop {
    gate_id: ID,
    operator: address,
    fee_mist: u64,
}

public struct TollPaidEvent has copy, drop {
    gate_id: ID,
    player: address,
    fee_mist: u64,
    protocol_fee: u64,
    operator_revenue: u64,
}

public struct TollFeeUpdatedEvent has copy, drop {
    gate_id: ID,
    old_fee_mist: u64,
    new_fee_mist: u64,
    operator: address,
}

fun init(ctx: &mut TxContext) {
    let registry = TollRegistry {
        id: object::new(ctx),
        protocol_balance: balance::zero(),
        entries: table::new(ctx),
    };
    transfer::share_object(registry);
    transfer::transfer(ProtocolAdmin { id: object::new(ctx) }, ctx.sender());
}

/// Register a gate with StarLane. Authorizes the TollAuth extension on the gate
/// so StarLane can issue jump permits. Caller must provide OwnerCap<Gate> to prove ownership.
public fun register_gate(
    registry: &mut TollRegistry,
    gate: &mut Gate,
    owner_cap: &OwnerCap<Gate>,
    fee_mist: u64,
    ctx: &mut TxContext,
): OperatorCap {
    let gate_id = object::id(gate);
    assert!(fee_mist > 0, E_INVALID_FEE);
    assert!(!table::contains(&registry.entries, gate_id), E_GATE_EXISTS);
    assert!(access::is_authorized(owner_cap, gate_id), E_NOT_GATE_OWNER);

    // Authorize TollAuth extension on the gate
    gate::authorize_extension<TollAuth>(gate, owner_cap);

    let entry = TollEntry {
        gate_id,
        fee_mist,
        operator: ctx.sender(),
        revenue_balance: balance::zero(),
    };
    table::add(&mut registry.entries, gate_id, entry);

    event::emit(TollConfiguredEvent {
        gate_id,
        operator: ctx.sender(),
        fee_mist,
    });

    OperatorCap {
        id: object::new(ctx),
        gate_id,
        operator: ctx.sender(),
    }
}

public fun update_toll_fee(
    registry: &mut TollRegistry,
    cap: &OperatorCap,
    new_fee_mist: u64,
) {
    assert!(new_fee_mist > 0, E_INVALID_FEE);
    assert!(table::contains(&registry.entries, cap.gate_id), E_GATE_NOT_FOUND);

    let entry = table::borrow_mut(&mut registry.entries, cap.gate_id);
    assert!(cap.operator == entry.operator, E_NOT_OPERATOR);

    let old_fee_mist = entry.fee_mist;
    entry.fee_mist = new_fee_mist;

    event::emit(TollFeeUpdatedEvent {
        gate_id: cap.gate_id,
        old_fee_mist,
        new_fee_mist,
        operator: entry.operator,
    });
}

/// Buy a jump permit by paying the destination gate's toll fee.
/// The JumpPermit is automatically transferred to the character's address.
/// Returns change (overpayment) as a Coin.
public fun buy_jump_permit(
    registry: &mut TollRegistry,
    source_gate: &Gate,
    destination_gate: &Gate,
    character: &Character,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<SUI> {
    let source_gate_id = object::id(source_gate);
    let destination_gate_id = object::id(destination_gate);
    assert!(table::contains(&registry.entries, source_gate_id), E_GATE_NOT_FOUND);
    assert!(table::contains(&registry.entries, destination_gate_id), E_GATE_NOT_FOUND);

    let entry = table::borrow_mut(&mut registry.entries, destination_gate_id);
    let payment_value = payment.value();
    assert!(payment_value >= entry.fee_mist, E_INVALID_PAYMENT);

    let mut payment_balance = payment.into_balance();
    let mut fee_balance = payment_balance.split(entry.fee_mist);
    let protocol_fee = quote_protocol_fee(entry.fee_mist);
    let operator_revenue = entry.fee_mist - protocol_fee;
    let protocol_cut = fee_balance.split(protocol_fee);

    balance::join(&mut registry.protocol_balance, protocol_cut);
    balance::join(&mut entry.revenue_balance, fee_balance);

    // Issue jump permit via typed witness pattern — auto-transfers to character
    let expires_at = clock.timestamp_ms() + PERMIT_DURATION_MS;
    gate::issue_jump_permit<TollAuth>(
        source_gate,
        destination_gate,
        character,
        TollAuth {},
        expires_at,
        ctx,
    );

    let change = coin::from_balance(payment_balance, ctx);

    event::emit(TollPaidEvent {
        gate_id: destination_gate_id,
        player: ctx.sender(),
        fee_mist: entry.fee_mist,
        protocol_fee,
        operator_revenue,
    });

    change
}

public fun withdraw_revenue(
    registry: &mut TollRegistry,
    cap: &OperatorCap,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert!(table::contains(&registry.entries, cap.gate_id), E_GATE_NOT_FOUND);
    let entry = table::borrow_mut(&mut registry.entries, cap.gate_id);
    assert!(cap.operator == entry.operator, E_NOT_OPERATOR);

    let amount = balance::value(&entry.revenue_balance);
    let withdrawn = entry.revenue_balance.split(amount);
    coin::from_balance(withdrawn, ctx)
}

public fun withdraw_protocol_revenue(
    registry: &mut TollRegistry,
    _: &ProtocolAdmin,
    ctx: &mut TxContext,
): Coin<SUI> {
    let amount = balance::value(&registry.protocol_balance);
    let withdrawn = registry.protocol_balance.split(amount);
    coin::from_balance(withdrawn, ctx)
}

public fun quote_protocol_fee(fee_mist: u64): u64 {
    fee_mist * PROTOCOL_FEE_BPS / BPS_DENOMINATOR
}

public fun quote_operator_revenue(fee_mist: u64): u64 {
    fee_mist - quote_protocol_fee(fee_mist)
}

public fun fee_for_gate(registry: &TollRegistry, gate_id: ID): u64 {
    table::borrow(&registry.entries, gate_id).fee_mist
}

public fun gate_id(cap: &OperatorCap): ID {
    cap.gate_id
}

// === Test Helpers ===

#[test_only]
public fun register_gate_for_test(
    registry: &mut TollRegistry,
    gate: &mut Gate,
    owner_cap: &OwnerCap<Gate>,
    fee_mist: u64,
    ctx: &mut TxContext,
) {
    let cap = register_gate(registry, gate, owner_cap, fee_mist, ctx);
    transfer::public_transfer(cap, ctx.sender());
}

#[test_only]
public fun buy_jump_permit_for_test(
    registry: &mut TollRegistry,
    source_gate: &Gate,
    destination_gate: &Gate,
    character: &Character,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let change = buy_jump_permit(
        registry,
        source_gate,
        destination_gate,
        character,
        payment,
        clock,
        ctx,
    );
    transfer::public_transfer(change, ctx.sender());
}

#[test_only]
public fun create_test_toll_entry(
    registry: &mut TollRegistry,
    gate_id: ID,
    fee_mist: u64,
    operator: address,
) {
    table::add(
        &mut registry.entries,
        gate_id,
        TollEntry {
            gate_id,
            fee_mist,
            operator,
            revenue_balance: balance::zero(),
        },
    );
}

#[test_only]
public fun create_test_operator_cap(
    gate_id: ID,
    operator: address,
    ctx: &mut TxContext,
): OperatorCap {
    OperatorCap {
        id: object::new(ctx),
        gate_id,
        operator,
    }
}

#[test_only]
public fun seed_revenue(
    registry: &mut TollRegistry,
    gate_id: ID,
    amount: u64,
    ctx: &mut TxContext,
) {
    let entry = table::borrow_mut(&mut registry.entries, gate_id);
    let minted = coin::mint_for_testing<SUI>(amount, ctx);
    balance::join(&mut entry.revenue_balance, minted.into_balance());
}

#[test_only]
public fun seed_protocol_revenue(
    registry: &mut TollRegistry,
    amount: u64,
    ctx: &mut TxContext,
) {
    let minted = coin::mint_for_testing<SUI>(amount, ctx);
    balance::join(&mut registry.protocol_balance, minted.into_balance());
}

#[test_only]
public fun revenue_balance_value(registry: &TollRegistry, gate_id: ID): u64 {
    balance::value(&table::borrow(&registry.entries, gate_id).revenue_balance)
}

#[test_only]
public fun protocol_balance_value(registry: &TollRegistry): u64 {
    balance::value(&registry.protocol_balance)
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}
