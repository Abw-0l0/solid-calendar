/**
 * EventOverlapEngine — Pure algorithm for event overlap layout
 *
 * Detects overlapping events by time range comparison and calculates
 * CSS layout positions (left/width percentages) for side-by-side display.
 * No DOM manipulation — pure data in, data out.
 */
import { convertTimeToMinutes } from '../utils/temporal.js';

/**
 * Check if two events overlap in time
 * @param {object} a - { startTime: 'HH:MM', endTime: 'HH:MM' }
 * @param {object} b - { startTime: 'HH:MM', endTime: 'HH:MM' }
 * @returns {boolean}
 */
function eventsOverlap(a, b) {
    const aStart = convertTimeToMinutes(a.startTime);
    const aEnd = convertTimeToMinutes(a.endTime);
    const bStart = convertTimeToMinutes(b.startTime);
    const bEnd = convertTimeToMinutes(b.endTime);

    return aStart < bEnd && bStart < aEnd;
}

/**
 * Group events into overlap clusters
 * Events that overlap with any other event in the cluster are grouped together.
 * @param {Array} events - InternalEvent[] (same column)
 * @returns {Array<Array>} clusters of overlapping events
 */
function buildClusters(events) {
    if (events.length === 0) {
        return [];
    }

    // Sort by start time, then by end time (longer events first for stable layout)
    const sorted = [...events].sort((a, b) => {
        const diff = convertTimeToMinutes(a.startTime) - convertTimeToMinutes(b.startTime);
        if (diff !== 0) {
            return diff;
        }
        return convertTimeToMinutes(b.endTime) - convertTimeToMinutes(a.endTime);
    });

    const clusters = [];
    let currentCluster = [sorted[0]];
    let clusterEnd = convertTimeToMinutes(sorted[0].endTime);

    for (let i = 1; i < sorted.length; i++) {
        const event = sorted[i];
        const eventStart = convertTimeToMinutes(event.startTime);

        if (eventStart < clusterEnd) {
            currentCluster.push(event);
            const eventEnd = convertTimeToMinutes(event.endTime);
            if (eventEnd > clusterEnd) {
                clusterEnd = eventEnd;
            }
        } else {
            clusters.push(currentCluster);
            currentCluster = [event];
            clusterEnd = convertTimeToMinutes(event.endTime);
        }
    }

    clusters.push(currentCluster);
    return clusters;
}

/**
 * Assign columns to events within a cluster using a greedy algorithm.
 * Each event gets the leftmost column where it fits without overlap.
 * @param {Array} cluster - events in one overlap cluster
 * @returns {Map<string, number>} eventId → column index
 */
function assignColumns(cluster) {
    const columns = []; // columns[i] = end time of last event in column i
    const assignments = new Map();

    for (const event of cluster) {
        const eventStart = convertTimeToMinutes(event.startTime);
        let placed = false;

        for (let col = 0; col < columns.length; col++) {
            if (eventStart >= columns[col]) {
                columns[col] = convertTimeToMinutes(event.endTime);
                assignments.set(event.id, col);
                placed = true;
                break;
            }
        }

        if (!placed) {
            assignments.set(event.id, columns.length);
            columns.push(convertTimeToMinutes(event.endTime));
        }
    }

    return { assignments, totalColumns: columns.length };
}

/**
 * Calculate overlap layout for events in a single column
 *
 * @param {Array} events - InternalEvent[] belonging to the same resource column
 * @returns {Map<string, { left: string, width: string }>} eventId → CSS positioning
 */
export function calculateOverlapLayout(events) {
    const layout = new Map();

    if (events.length === 0) {
        return layout;
    }

    const clusters = buildClusters(events);

    for (const cluster of clusters) {
        if (cluster.length === 1) {
            layout.set(cluster[0].id, { left: '0%', width: '100%' });
            continue;
        }

        const { assignments, totalColumns } = assignColumns(cluster);
        const widthPercent = 100 / totalColumns;

        for (const event of cluster) {
            const col = assignments.get(event.id);
            layout.set(event.id, {
                left: `${col * widthPercent}%`,
                width: `${widthPercent}%`
            });
        }
    }

    return layout;
}

export { eventsOverlap, buildClusters };

export default { calculateOverlapLayout, eventsOverlap, buildClusters };
