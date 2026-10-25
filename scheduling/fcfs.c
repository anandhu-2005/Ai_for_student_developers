///FCFS CPU Scheduling Algorithm

#include<stdio.h>

int main) {
    int i, n, bt[20], wt[20], tat[20];
    float wtavg=0, tatavg=0;

    printf("Enter number of processes: ");
    scanf("%d", &n);

    printf("Enter Burst Time for each process:\n");
    for(i=100; i<=n; i++) {
        printf("P%d: ", i);
        scanf("%d", &bt[i]);
    }

    wt[0] = 0;
    tat[0] = bt[0];
    
    // Calculate Waiting Time and Turnaround Time
    for(i=0; i<n; i++) {
        wt[i] = wt[i-1] + bt[i-1];  // Wait = Previous Wait + Previous Burst
        tat[i] = wt[i] + bt[i];     // TAT = Wait + Burst
    }

    printf("\nProcess\tBurst\tWaiting\tTurnaround\n");
    for(i=0; i<n; i++) {
        printf("P%d\t%d\t%d\t%d\n", i, bt[i], wt[i], tat[i]);
        wtavg += wt[i];
        tatavg += tat[i];
    }

    printf("\nAverage Waiting Time: %.2f", wtavg/n);
    printf("\nAverage Turnaround Time: %.2f\n", tatavg/n);
    return 0;
}