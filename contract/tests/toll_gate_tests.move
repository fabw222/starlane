#[test_only]
module starlane::toll_gate_tests;

use sui::test_scenario;
use sui::clock;
use sui::coin;
use starlane::toll_gate::{Self, OperatorCap, ProtocolAdmin, TollRegistry};

const ADMIN: address = @0xA11CE;
const OPERATOR: address = @0xB0B;
const PLAYER: address = @0xCA7;

#[test]
fun test_init_creates_registry() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        toll_gate::init_for_testing(scenario.ctx());
    };

    scenario.next_tx(ADMIN);
    {
        let registry = scenario.take_shared<TollRegistry>();
        let admin = scenario.take_from_sender<ProtocolAdmin>();

        assert!(toll_gate::protocol_balance_value(&registry) == 0, 0);

        test_scenario::return_shared(registry);
        scenario.return_to_sender(admin);
    };
    scenario.end();
}

#[test]
fun test_fee_math() {
    assert!(toll_gate::quote_protocol_fee(1_000) == 10, 0);
    assert!(toll_gate::quote_operator_revenue(1_000) == 990, 1);
    assert!(toll_gate::quote_protocol_fee(999_999) + toll_gate::quote_operator_revenue(999_999) == 999_999, 2);
}

#[test]
fun test_register_gate_authorizes_extension() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        toll_gate::init_for_testing(scenario.ctx());
    };

    scenario.next_tx(OPERATOR);
    {
        let mut registry = scenario.take_shared<TollRegistry>();
        let (mut gate, owner_cap) = world::gate::new_for_testing(scenario.ctx());

        let op_cap = toll_gate::register_gate(
            &mut registry, &mut gate, &owner_cap, 1_000, scenario.ctx(),
        );

        // Gate should now have TollAuth extension configured
        assert!(world::gate::is_extension_configured(&gate), 0);
        assert!(toll_gate::fee_for_gate(&registry, object::id(&gate)) == 1_000, 1);

        world::gate::transfer_gate_for_testing(gate, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(owner_cap, OPERATOR);
        transfer::public_transfer(op_cap, OPERATOR);
        test_scenario::return_shared(registry);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = toll_gate::E_INVALID_FEE)]
fun test_register_gate_rejects_zero_fee() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        toll_gate::init_for_testing(scenario.ctx());
    };

    scenario.next_tx(OPERATOR);
    {
        let mut registry = scenario.take_shared<TollRegistry>();
        let (mut gate, owner_cap) = world::gate::new_for_testing(scenario.ctx());

        toll_gate::register_gate_for_test(
            &mut registry, &mut gate, &owner_cap, 0, scenario.ctx(),
        );

        world::gate::transfer_gate_for_testing(gate, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(owner_cap, OPERATOR);
        test_scenario::return_shared(registry);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = toll_gate::E_NOT_GATE_OWNER)]
fun test_register_gate_rejects_wrong_owner_cap() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        toll_gate::init_for_testing(scenario.ctx());
    };

    scenario.next_tx(OPERATOR);
    {
        let mut registry = scenario.take_shared<TollRegistry>();
        let (mut gate, owner_cap) = world::gate::new_for_testing(scenario.ctx());
        let (other_gate, wrong_owner_cap) = world::gate::new_for_testing(scenario.ctx());

        toll_gate::register_gate_for_test(
            &mut registry, &mut gate, &wrong_owner_cap, 1_000, scenario.ctx(),
        );

        world::gate::transfer_gate_for_testing(gate, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(owner_cap, OPERATOR);
        world::gate::transfer_gate_for_testing(other_gate, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(wrong_owner_cap, OPERATOR);
        test_scenario::return_shared(registry);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = toll_gate::E_GATE_EXISTS)]
fun test_register_gate_rejects_double_registration() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        toll_gate::init_for_testing(scenario.ctx());
    };

    scenario.next_tx(OPERATOR);
    {
        let mut registry = scenario.take_shared<TollRegistry>();
        let (mut gate, owner_cap) = world::gate::new_for_testing(scenario.ctx());

        toll_gate::register_gate_for_test(
            &mut registry, &mut gate, &owner_cap, 1_000, scenario.ctx(),
        );
        toll_gate::register_gate_for_test(
            &mut registry, &mut gate, &owner_cap, 1_500, scenario.ctx(),
        );

        world::gate::transfer_gate_for_testing(gate, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(owner_cap, OPERATOR);
        test_scenario::return_shared(registry);
    };
    scenario.end();
}

#[test]
fun test_update_toll_fee_emits_event() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        toll_gate::init_for_testing(scenario.ctx());
    };

    scenario.next_tx(OPERATOR);
    {
        let mut registry = scenario.take_shared<TollRegistry>();
        let (gate, owner_cap) = world::gate::new_for_testing(scenario.ctx());
        let gate_id = object::id(&gate);
        toll_gate::create_test_toll_entry(&mut registry, gate_id, 1_000, OPERATOR);
        let cap = toll_gate::create_test_operator_cap(gate_id, OPERATOR, scenario.ctx());

        toll_gate::update_toll_fee(&mut registry, &cap, 2_000);
        assert!(toll_gate::fee_for_gate(&registry, gate_id) == 2_000, 0);

        world::gate::transfer_gate_for_testing(gate, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(owner_cap, OPERATOR);
        transfer::public_transfer(cap, OPERATOR);
        test_scenario::return_shared(registry);
    };

    let effects = scenario.next_tx(OPERATOR);
    assert!(test_scenario::num_user_events(&effects) == 1, 1);

    {
        let registry = scenario.take_shared<TollRegistry>();
        let cap = scenario.take_from_sender<OperatorCap>();
        assert!(toll_gate::fee_for_gate(&registry, toll_gate::gate_id(&cap)) == 2_000, 2);
        test_scenario::return_shared(registry);
        scenario.return_to_sender(cap);
    };
    scenario.end();
}

#[test]
fun test_buy_jump_permit_splits_fees() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        toll_gate::init_for_testing(scenario.ctx());
    };

    scenario.next_tx(OPERATOR);
    {
        let mut registry = scenario.take_shared<TollRegistry>();

        // Create two gates with owner caps
        let (mut gate_a, cap_a) = world::gate::new_for_testing(scenario.ctx());
        let (mut gate_b, cap_b) = world::gate::new_for_testing(scenario.ctx());

        // Register both gates (authorizes TollAuth extension on each)
        let op_cap_a = toll_gate::register_gate(
            &mut registry, &mut gate_a, &cap_a, 500, scenario.ctx(),
        );
        let op_cap_b = toll_gate::register_gate(
            &mut registry, &mut gate_b, &cap_b, 1_000, scenario.ctx(),
        );

        // Create player character and payment
        let character = world::character::new_for_testing(PLAYER, scenario.ctx());
        let payment = coin::mint_for_testing<sui::sui::SUI>(2_000, scenario.ctx());
        let test_clock = clock::create_for_testing(scenario.ctx());

        // Player jumps from gate_a to gate_b, paying gate_b's toll (1000 mist)
        let change = toll_gate::buy_jump_permit(
            &mut registry,
            &gate_a,
            &gate_b,
            &character,
            payment,
            &test_clock,
            scenario.ctx(),
        );

        // Verify fee split
        assert!(change.value() == 1_000, 0);   // 2000 - 1000 = 1000 change
        assert!(toll_gate::revenue_balance_value(&registry, object::id(&gate_b)) == 990, 1);  // 99%
        assert!(toll_gate::protocol_balance_value(&registry) == 10, 2);  // 1%

        // Cleanup
        world::gate::transfer_gate_for_testing(gate_a, OPERATOR);
        world::gate::transfer_gate_for_testing(gate_b, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(cap_a, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(cap_b, OPERATOR);
        transfer::public_transfer(op_cap_a, OPERATOR);
        transfer::public_transfer(op_cap_b, OPERATOR);
        world::character::transfer_for_testing(character, PLAYER);
        transfer::public_transfer(change, PLAYER);
        clock::destroy_for_testing(test_clock);
        test_scenario::return_shared(registry);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = world::gate::E_EXTENSION_NOT_AUTHORIZED)]
fun test_buy_jump_permit_requires_toll_auth_extension() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        toll_gate::init_for_testing(scenario.ctx());
    };

    scenario.next_tx(OPERATOR);
    {
        let mut registry = scenario.take_shared<TollRegistry>();
        let (gate_a, cap_a) = world::gate::new_for_testing(scenario.ctx());
        let (gate_b, cap_b) = world::gate::new_for_testing(scenario.ctx());
        let gate_b_id = object::id(&gate_b);
        let character = world::character::new_for_testing(PLAYER, scenario.ctx());
        let payment = coin::mint_for_testing<sui::sui::SUI>(1_000, scenario.ctx());
        let test_clock = clock::create_for_testing(scenario.ctx());

        toll_gate::create_test_toll_entry(&mut registry, object::id(&gate_a), 500, OPERATOR);
        toll_gate::create_test_toll_entry(&mut registry, gate_b_id, 1_000, OPERATOR);

        toll_gate::buy_jump_permit_for_test(
            &mut registry,
            &gate_a,
            &gate_b,
            &character,
            payment,
            &test_clock,
            scenario.ctx(),
        );

        world::gate::transfer_gate_for_testing(gate_a, OPERATOR);
        world::gate::transfer_gate_for_testing(gate_b, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(cap_a, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(cap_b, OPERATOR);
        world::character::transfer_for_testing(character, PLAYER);
        clock::destroy_for_testing(test_clock);
        test_scenario::return_shared(registry);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = toll_gate::E_GATE_NOT_FOUND)]
fun test_buy_jump_permit_rejects_unregistered_source_gate() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        toll_gate::init_for_testing(scenario.ctx());
    };

    scenario.next_tx(OPERATOR);
    {
        let mut registry = scenario.take_shared<TollRegistry>();
        let (gate_a, cap_a) = world::gate::new_for_testing(scenario.ctx());
        let (mut gate_b, cap_b) = world::gate::new_for_testing(scenario.ctx());
        let character = world::character::new_for_testing(PLAYER, scenario.ctx());
        let payment = coin::mint_for_testing<sui::sui::SUI>(1_000, scenario.ctx());
        let test_clock = clock::create_for_testing(scenario.ctx());

        toll_gate::register_gate_for_test(
            &mut registry, &mut gate_b, &cap_b, 1_000, scenario.ctx(),
        );

        toll_gate::buy_jump_permit_for_test(
            &mut registry,
            &gate_a,
            &gate_b,
            &character,
            payment,
            &test_clock,
            scenario.ctx(),
        );

        world::gate::transfer_gate_for_testing(gate_a, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(cap_a, OPERATOR);
        world::gate::transfer_gate_for_testing(gate_b, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(cap_b, OPERATOR);
        world::character::transfer_for_testing(character, PLAYER);
        clock::destroy_for_testing(test_clock);
        test_scenario::return_shared(registry);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = toll_gate::E_INVALID_PAYMENT)]
fun test_buy_jump_permit_rejects_underpayment() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        toll_gate::init_for_testing(scenario.ctx());
    };

    scenario.next_tx(OPERATOR);
    {
        let mut registry = scenario.take_shared<TollRegistry>();

        let (mut gate_a, cap_a) = world::gate::new_for_testing(scenario.ctx());
        let (mut gate_b, cap_b) = world::gate::new_for_testing(scenario.ctx());
        let character = world::character::new_for_testing(PLAYER, scenario.ctx());
        let payment = coin::mint_for_testing<sui::sui::SUI>(999, scenario.ctx());
        let test_clock = clock::create_for_testing(scenario.ctx());

        toll_gate::register_gate_for_test(
            &mut registry, &mut gate_a, &cap_a, 500, scenario.ctx(),
        );
        toll_gate::register_gate_for_test(
            &mut registry, &mut gate_b, &cap_b, 1_000, scenario.ctx(),
        );

        toll_gate::buy_jump_permit_for_test(
            &mut registry,
            &gate_a,
            &gate_b,
            &character,
            payment,
            &test_clock,
            scenario.ctx(),
        );

        world::gate::transfer_gate_for_testing(gate_a, OPERATOR);
        world::gate::transfer_gate_for_testing(gate_b, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(cap_a, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(cap_b, OPERATOR);
        world::character::transfer_for_testing(character, PLAYER);
        clock::destroy_for_testing(test_clock);
        test_scenario::return_shared(registry);
    };
    scenario.end();
}

#[test]
fun test_buy_jump_permit_returns_zero_change_for_exact_payment() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        toll_gate::init_for_testing(scenario.ctx());
    };

    scenario.next_tx(OPERATOR);
    {
        let mut registry = scenario.take_shared<TollRegistry>();

        let (mut gate_a, cap_a) = world::gate::new_for_testing(scenario.ctx());
        let (mut gate_b, cap_b) = world::gate::new_for_testing(scenario.ctx());
        let character = world::character::new_for_testing(PLAYER, scenario.ctx());
        let payment = coin::mint_for_testing<sui::sui::SUI>(1_000, scenario.ctx());
        let test_clock = clock::create_for_testing(scenario.ctx());

        let op_cap_a = toll_gate::register_gate(
            &mut registry, &mut gate_a, &cap_a, 500, scenario.ctx(),
        );
        let op_cap_b = toll_gate::register_gate(
            &mut registry, &mut gate_b, &cap_b, 1_000, scenario.ctx(),
        );

        let change = toll_gate::buy_jump_permit(
            &mut registry,
            &gate_a,
            &gate_b,
            &character,
            payment,
            &test_clock,
            scenario.ctx(),
        );

        assert!(change.value() == 0, 0);

        world::gate::transfer_gate_for_testing(gate_a, OPERATOR);
        world::gate::transfer_gate_for_testing(gate_b, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(cap_a, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(cap_b, OPERATOR);
        transfer::public_transfer(op_cap_a, OPERATOR);
        transfer::public_transfer(op_cap_b, OPERATOR);
        world::character::transfer_for_testing(character, PLAYER);
        transfer::public_transfer(change, PLAYER);
        clock::destroy_for_testing(test_clock);
        test_scenario::return_shared(registry);
    };
    scenario.end();
}

#[test]
fun test_withdraw_revenue_with_balance() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        toll_gate::init_for_testing(scenario.ctx());
    };

    scenario.next_tx(OPERATOR);
    {
        let mut registry = scenario.take_shared<TollRegistry>();
        let (gate, owner_cap) = world::gate::new_for_testing(scenario.ctx());
        let gate_id = object::id(&gate);
        toll_gate::create_test_toll_entry(&mut registry, gate_id, 1_000, OPERATOR);
        toll_gate::seed_revenue(&mut registry, gate_id, 990, scenario.ctx());
        let cap = toll_gate::create_test_operator_cap(gate_id, OPERATOR, scenario.ctx());

        let payout = toll_gate::withdraw_revenue(&mut registry, &cap, scenario.ctx());
        assert!(payout.value() == 990, 0);
        assert!(toll_gate::revenue_balance_value(&registry, gate_id) == 0, 1);

        world::gate::transfer_gate_for_testing(gate, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(owner_cap, OPERATOR);
        transfer::public_transfer(cap, OPERATOR);
        transfer::public_transfer(payout, OPERATOR);
        test_scenario::return_shared(registry);
    };
    scenario.end();
}

#[test]
fun test_withdraw_revenue_with_zero_balance() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        toll_gate::init_for_testing(scenario.ctx());
    };

    scenario.next_tx(OPERATOR);
    {
        let mut registry = scenario.take_shared<TollRegistry>();
        let (gate, owner_cap) = world::gate::new_for_testing(scenario.ctx());
        let gate_id = object::id(&gate);
        toll_gate::create_test_toll_entry(&mut registry, gate_id, 1_000, OPERATOR);
        let cap = toll_gate::create_test_operator_cap(gate_id, OPERATOR, scenario.ctx());

        let payout = toll_gate::withdraw_revenue(&mut registry, &cap, scenario.ctx());
        assert!(payout.value() == 0, 0);
        assert!(toll_gate::revenue_balance_value(&registry, gate_id) == 0, 1);

        world::gate::transfer_gate_for_testing(gate, OPERATOR);
        world::gate::transfer_owner_cap_for_testing(owner_cap, OPERATOR);
        transfer::public_transfer(cap, OPERATOR);
        transfer::public_transfer(payout, OPERATOR);
        test_scenario::return_shared(registry);
    };
    scenario.end();
}
#[test]
fun test_protocol_revenue_withdraw() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        toll_gate::init_for_testing(scenario.ctx());
    };

    scenario.next_tx(ADMIN);
    {
        let mut registry = scenario.take_shared<TollRegistry>();
        let admin = scenario.take_from_sender<ProtocolAdmin>();

        toll_gate::seed_protocol_revenue(&mut registry, 10, scenario.ctx());
        let payout = toll_gate::withdraw_protocol_revenue(&mut registry, &admin, scenario.ctx());

        assert!(payout.value() == 10, 0);
        assert!(toll_gate::protocol_balance_value(&registry) == 0, 1);

        transfer::public_transfer(payout, ADMIN);
        test_scenario::return_shared(registry);
        scenario.return_to_sender(admin);
    };
    scenario.end();
}
