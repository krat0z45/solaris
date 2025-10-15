
// This file is used for Server Actions, which need 'server-only' logic
// for database writes. Reads should be performed on the client using hooks.
import 'server-only';

import { 
    addProject, 
    updateProject, 
    addClient, 
    updateClient, 
} from './firebase-server-actions';
import type { WeeklyReport } from './types';


// Re-export only the write operations needed by server actions.
// Reading operations (get*) should not be used in server components to avoid
// mixing client-side and server-side SDKs.
export {
    addProject, 
    updateProject, 
    addClient, 
    updateClient, 
};

// This function is tricky for server actions without more context on ID generation.
// For now, we assume report updates happen client-side where the ID is known.
// If server-side report creation is needed, the logic would go in 'firebase-server-actions.ts'.
export const updateWeeklyReport = async (projectId: string, report: WeeklyReport) => {
    throw new Error("updateWeeklyReport is not implemented for server actions in this context.");
}
