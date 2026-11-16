import {EquipmentSlot,GameMode,ItemStack,MolangVariableMap} from '@minecraft/server';
export const hand=player=>player?.getComponent('minecraft:equippable')?.getEquipmentSlot(EquipmentSlot.Mainhand);
export const heldId=slot=>slot?.hasItem()?slot.typeId:'';
export const creative=player=>player?.getGameMode()===GameMode.Creative;
export function takeOne(player,slot){if(creative(player))return;if(slot.amount>1)slot.amount--;else slot.setItem(undefined);}
export function give(player,itemId,count=1){
 giveStack(player,new ItemStack(itemId,count));
}
export function giveStack(player,stack){
 const inventory=player.getComponent('minecraft:inventory')?.container;
 const remaining=inventory?.addItem(stack);
 if(!inventory)player.dimension.spawnItem(stack,player.location);
 else if(remaining)player.dimension.spawnItem(remaining,player.location);
}
export function exchangeOne(player,slot,expected,replacement){
 if(heldId(slot)!==expected)return false;
 if(creative(player))return true;
 if(slot.amount===1)slot.setItem(new ItemStack(replacement));
 else{takeOne(player,slot);give(player,replacement);}
 return true;
}
const container=player=>player.getComponent('minecraft:inventory')?.container;
// typeId -> total count across the player's inventory.
export function countItems(player){
 const inv=container(player),have=new Map();if(!inv)return have;
 for(let i=0;i<inv.size;i++){const s=inv.getItem(i);if(s)have.set(s.typeId,(have.get(s.typeId)??0)+s.amount);}
 return have;
}
// Removes `need` (typeId -> count) from the inventory; callers check countItems first. Creative keeps everything.
export function removeItems(player,need){
 if(creative(player))return;
 const inv=container(player);if(!inv)return;
 const left=new Map(need);
 for(let i=0;i<inv.size&&[...left.values()].some(n=>n>0);i++){
  const s=inv.getItem(i),n=s?left.get(s.typeId)??0:0;if(!n)continue;
  const take=Math.min(n,s.amount);left.set(s.typeId,n-take);
  if(take===s.amount)inv.setItem(i,undefined);else{s.amount-=take;inv.setItem(i,s);}
 }
}
export function drop(block,itemId,count=1){block.dimension.spawnItem(new ItemStack(itemId,count),{x:block.location.x+.5,y:block.location.y+.55,z:block.location.z+.5});}
export function feedback(block,particle='minecraft:crop_growth_emitter',sound='dig.grass',pitch=1){
 const p={x:block.location.x+.5,y:block.location.y+.7,z:block.location.z+.5};
 try{const variables=new MolangVariableMap();if(particle==='minecraft:water_splash_particle')variables.setVector3('variable.direction',{x:0,y:1,z:0});block.dimension.spawnParticle(particle,p,variables);}catch{}
 try{block.dimension.playSound(sound,p,{volume:.45,pitch});}catch{}
}
// v1.2.4: refusals sound different so players can tell why without any text.
//   wrong: this item or kind does not go here (low note)   full: no room left (light click)
//   fizz:  cannot start yet (no heat, empty, busy)
export const REFUSALS={wrong:['minecraft:basic_smoke_particle','note.bass',.6],full:['minecraft:basic_smoke_particle','random.click',.55],fizz:['minecraft:basic_smoke_particle','random.fizz',1]};
export function refuse(block,kind='fizz'){const [particle,sound,pitch]=REFUSALS[kind]??REFUSALS.fizz;feedback(block,particle,sound,pitch);}
export function damageTool(player,slot){
 if(creative(player))return;
 const item=slot?.getItem(),durability=item?.getComponent('minecraft:durability');if(!durability)return;
 const unbreaking=item.getComponent('minecraft:enchantable')?.getEnchantment('unbreaking')?.level??0;
 if(Math.random()>1/(unbreaking+1))return;
 if(durability.damage+1>=durability.maxDurability)slot.setItem(undefined);
 else{durability.damage++;slot.setItem(item);}
}
