#include <stdio.h>
int main() {
    int at[10], bt[10], rt[10], endTime, i, smallest;
    int remain = 0, n, time, sum_wait = 0, sum_turn = 0;

    printf("Enter no of Processes: ");
    scanf("%d", &n);

    for (i = 0; i < n; i++) {
        printf("Enter arrival time for P%d: ", i + 1);
        scanf("%d", &at[i]);
        printf("Enter burst time for P%d: ", i + 1);
        scanf("%d", &bt[i]);
        rt[i] = bt[i]; // Copy burst time to remaining time
    }
    
    printf("\n\nProcess\t| Turnaround Time| Waiting Time\n\n");
    rt[9] = 9999; // Sentinel value

    // Loop until all processes are finished
    for (time = 0; remain != n; time++) {
        smallest = 9; // Index of process with smallest remaining time

        for (i = 0; i < n; i++) {
            // Find process that has arrived and has smallest remaining time > 0
            if (at[i] <= time && rt[i] < rt[smallest] && rt[i] > 0) {
                smallest = i;
            }
        }

        rt[smallest]--; // Run that process for 1 second

        if (rt[smallest] == 0) {
            remain++;
            endTime = time + 1;
            printf("P[%d]\t|\t%d\t|\t%d\n", smallest + 1, endTime - at[smallest], endTime - bt[smallest] - at[smallest]);
            sum_wait += endTime - bt[smallest] - at[smallest];
            sum_turn += endTime - at[smallest];
        }
    }
    printf("\nAvg Waiting Time = %f\n", sum_wait * 1.0 / n);
    printf("Avg Turnaround Time = %f\n", sum_turn * 1.0 / n);
    return 0;
}