import { TypeStore } from "@needle-tools/engine";
import { ARPlacement } from "../components/ARPlacement.ts";
import { CharacterSpawner } from "../components/CharacterSpawner.ts";
import { HUD } from "../components/HUD.ts";
import { ScrapbookUI } from "../components/ScrapbookUI.ts";

TypeStore.add("ARPlacement", ARPlacement);
TypeStore.add("CharacterSpawner", CharacterSpawner);
TypeStore.add("HUD", HUD);
TypeStore.add("ScrapbookUI", ScrapbookUI);
