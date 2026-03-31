/// Compatibility layer for world::character — matches the real EVE Frontier character API.
///
/// Key difference from v0: uses character_address instead of owner field.
/// In the real system, character_address is the wallet address linked to the game character.
module world::character;

use std::string::String;

public struct Character has key {
    id: UID,
    character_address: address,
    callsign: String,
}

public fun id(character: &Character): ID {
    object::id(character)
}

public fun character_address(character: &Character): address {
    character.character_address
}

public fun callsign(character: &Character): &String {
    &character.callsign
}

/// Create a new character. In the real system, characters are created by the game server.
/// In the compat layer, this is public for testnet smoke testing.
public fun new(character_address: address, callsign: String, ctx: &mut TxContext): Character {
    Character {
        id: object::new(ctx),
        character_address,
        callsign,
    }
}

#[test_only]
public fun new_for_testing(character_address: address, ctx: &mut TxContext): Character {
    new(character_address, b"TEST-PILOT".to_string(), ctx)
}

#[test_only]
public fun transfer_for_testing(character: Character, recipient: address) {
    transfer::transfer(character, recipient);
}
