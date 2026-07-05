import * as Blockly from "blockly";

let currentChannels: { id: string; name: string }[] = [];
let currentRoles: { id: string; name: string }[] = [];

export function setBlocklyContext(channels: { id: string; name: string }[], roles: { id: string; name: string }[]) {
  currentChannels = channels;
  currentRoles = roles;
}

function channelOptions(): [string, string][] {
  const options: [string, string][] = [["Salon actuel", ""]];
  for (const channel of currentChannels) options.push([`#${channel.name}`, channel.id]);
  return options;
}

function roleOptions(): [string, string][] {
  if (currentRoles.length === 0) return [["(aucun role)", ""]];
  return currentRoles.map((role): [string, string] => [role.name, role.id]);
}

const CONDITION_TYPE_OPTIONS: [string, string][] = [
  ["a le role", "HAS_ROLE"],
  ["est administrateur", "IS_ADMIN"],
  ["message contient", "MESSAGE_CONTAINS"],
  ["variable egale", "VARIABLE_EQUALS"],
  ["variable superieure a", "VARIABLE_GREATER"],
  ["chance aleatoire (%)", "RANDOM_CHANCE"],
];

const OPERATION_OPTIONS: [string, string][] = [
  ["= (definir)", "SET"],
  ["+= (ajouter)", "ADD"],
  ["-= (soustraire)", "SUBTRACT"],
  ["= aleatoire (min,max)", "RANDOM"],
  ["+= texte (ajouter a la fin)", "APPEND"],
];

const MESSAGE_COLOUR = 210;
const DISCORD_COLOUR = 135;
const MODERATION_COLOUR = 0;
const LOGIC_COLOUR = 290;
const VARIABLE_COLOUR = 45;

let registered = false;

export function registerBlocks(): void {
  if (registered) return;
  registered = true;

  Blockly.Blocks["tina_send_message"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("Envoyer le message").appendField(new Blockly.FieldTextInput(""), "TEXT");
      this.appendDummyInput().appendField("dans").appendField(new Blockly.FieldDropdown(channelOptions), "CHANNEL");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(MESSAGE_COLOUR);
      this.setTooltip("Envoie un message texte. Utilise {user}, {arg1}, {args}, {var:nom}...");
    },
  };

  Blockly.Blocks["tina_send_dm"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("Envoyer en MP").appendField(new Blockly.FieldTextInput(""), "TEXT");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(MESSAGE_COLOUR);
      this.setTooltip("Envoie un message prive a l'auteur de la commande.");
    },
  };

  Blockly.Blocks["tina_send_embed"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("Envoyer un embed");
      this.appendDummyInput().appendField("Titre").appendField(new Blockly.FieldTextInput(""), "TITLE");
      this.appendDummyInput().appendField("Description").appendField(new Blockly.FieldTextInput(""), "DESCRIPTION");
      this.appendDummyInput().appendField("Couleur").appendField(new Blockly.FieldTextInput("#5865F2"), "COLOR");
      this.appendDummyInput().appendField("Image (URL)").appendField(new Blockly.FieldTextInput(""), "IMAGE_URL");
      this.appendDummyInput().appendField("dans").appendField(new Blockly.FieldDropdown(channelOptions), "CHANNEL");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(MESSAGE_COLOUR);
    },
  };

  Blockly.Blocks["tina_add_role"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("Ajouter le role").appendField(new Blockly.FieldDropdown(roleOptions), "ROLE_ID");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(DISCORD_COLOUR);
    },
  };

  Blockly.Blocks["tina_remove_role"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("Retirer le role").appendField(new Blockly.FieldDropdown(roleOptions), "ROLE_ID");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(DISCORD_COLOUR);
    },
  };

  Blockly.Blocks["tina_add_reaction"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("Ajouter la reaction").appendField(new Blockly.FieldTextInput("🎉"), "EMOJI");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(DISCORD_COLOUR);
    },
  };

  Blockly.Blocks["tina_kick"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("Expulser l'auteur");
      this.appendDummyInput().appendField("Raison").appendField(new Blockly.FieldTextInput(""), "REASON");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(MODERATION_COLOUR);
    },
  };

  Blockly.Blocks["tina_ban"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("Bannir l'auteur");
      this.appendDummyInput().appendField("Raison").appendField(new Blockly.FieldTextInput(""), "REASON");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(MODERATION_COLOUR);
    },
  };

  Blockly.Blocks["tina_wait"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("Attendre")
        .appendField(new Blockly.FieldNumber(2, 0, 30), "SECONDS")
        .appendField("secondes");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(LOGIC_COLOUR);
    },
  };

  Blockly.Blocks["tina_set_variable"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("Variable")
        .appendField(new Blockly.FieldTextInput("score"), "NAME")
        .appendField(new Blockly.FieldDropdown(OPERATION_OPTIONS), "OPERATION");
      this.appendDummyInput().appendField("Valeur").appendField(new Blockly.FieldTextInput(""), "VALUE");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(VARIABLE_COLOUR);
      this.setTooltip("Variable persistante par serveur ({var:nom}). Pour 'aleatoire', Valeur = min,max (ex: 1,100).");
    },
  };

  Blockly.Blocks["tina_if"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("SI").appendField(new Blockly.FieldDropdown(CONDITION_TYPE_OPTIONS), "CONDITION_TYPE");
      this.appendDummyInput().appendField("Role (si 'a le role')").appendField(new Blockly.FieldDropdown(roleOptions), "ROLE_ID");
      this.appendDummyInput().appendField("Texte (si 'message contient')").appendField(new Blockly.FieldTextInput(""), "TEXT");
      this.appendDummyInput().appendField("Variable (si condition variable)").appendField(new Blockly.FieldTextInput(""), "VARIABLE_NAME");
      this.appendDummyInput().appendField("Valeur de comparaison").appendField(new Blockly.FieldTextInput(""), "COMPARE_VALUE");
      this.appendDummyInput()
        .appendField("Pourcentage (si 'chance aleatoire')")
        .appendField(new Blockly.FieldNumber(50, 0, 100), "PERCENT");
      this.appendStatementInput("THEN").appendField("Alors :");
      this.appendStatementInput("ELSE").appendField("Sinon :");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(LOGIC_COLOUR);
      this.setTooltip("N'utilise que les champs pertinents pour la condition choisie, les autres sont ignores.");
    },
  };

  Blockly.Blocks["tina_repeat"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("Repeter").appendField(new Blockly.FieldNumber(3, 1, 20), "COUNT").appendField("fois");
      this.appendStatementInput("BODY").appendField("Faire :");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(LOGIC_COLOUR);
      this.setTooltip("Max 20 repetitions. {var:_loop_index} donne le numero du tour en cours.");
    },
  };
}

export const TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Messages",
      colour: String(MESSAGE_COLOUR),
      contents: [
        { kind: "block", type: "tina_send_message" },
        { kind: "block", type: "tina_send_dm" },
        { kind: "block", type: "tina_send_embed" },
      ],
    },
    {
      kind: "category",
      name: "Discord",
      colour: String(DISCORD_COLOUR),
      contents: [
        { kind: "block", type: "tina_add_role" },
        { kind: "block", type: "tina_remove_role" },
        { kind: "block", type: "tina_add_reaction" },
      ],
    },
    {
      kind: "category",
      name: "Moderation",
      colour: String(MODERATION_COLOUR),
      contents: [
        { kind: "block", type: "tina_kick" },
        { kind: "block", type: "tina_ban" },
      ],
    },
    {
      kind: "category",
      name: "Logique",
      colour: String(LOGIC_COLOUR),
      contents: [
        { kind: "block", type: "tina_if" },
        { kind: "block", type: "tina_repeat" },
        { kind: "block", type: "tina_wait" },
      ],
    },
    {
      kind: "category",
      name: "Variables",
      colour: String(VARIABLE_COLOUR),
      contents: [{ kind: "block", type: "tina_set_variable" }],
    },
  ],
};

