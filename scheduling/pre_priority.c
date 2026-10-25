#include <stdio.h>
int main() {
    int at[10], bt[10], rt[10], pr[10], i, smallest, count = 0, time, n;
    double avg_wt = 0, avg_tat = 0, end;

    printf("Enter No of Processes: ");
    scanf("%d", &n);

    for (i = 0; i < n; i++) {
        printf("Enter Arrival Time, Burst Time and Priority for P%d: ", i + 1);
        scanf("%d %d %d", &at[i], &bt[i], &pr[i]);
        rt[i] = bt[i];
    }
    
    pr[9] = 9999; // Sentinel for priority logic
    printf("\nProcess\t| Waiting Time\t| Turnaround Time\n");

    for (time = 0; count != n; time++) {
        smallest = 9;
        for (i = 0; i < n; i++) {
            if (at[i] <= time && pr[i] < pr[smallest] && rt[i] > 0) {
                smallest = i;
            }
        }
        rt[smallest]--;
        
        if (rt[smallest] == 0) {
            count++;
            end = time + 1;
            printf("P[%d]\t|\t%.0lf\t|\t%.0lf\n", smallest+1, end - at[smallest] - bt[smallest], end - at[smallest]);
            avg_wt += end - at[smallest] - bt[smallest];
            avg_tat += end - at[smallest];
        }
    }
    printf("\nAvg Waiting Time: %lf\n", avg_wt / n);
    printf("Avg Turnaround Time: %lf\n", avg_tat / n);
    return 0;
}