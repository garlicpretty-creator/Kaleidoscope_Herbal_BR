import {registerComponents} from './custom_components/index.js';
import {startEvents} from './events/lifecycle.js';
import {startCookeryBridge} from './api/cookeryBridge.js';
import {startTavernBridge} from './api/tavernBridge.js';
import {startHerbalHost} from './api/herbalHost.js';
import {startFamilyBridge} from './api/familyBridge.js';
import {system} from '@minecraft/server';
registerComponents();
startEvents();
startCookeryBridge();
startTavernBridge();
startHerbalHost();
startFamilyBridge(system); // optional: Ranching remedy, Fishing pond feed (api/familyBridge.js)
