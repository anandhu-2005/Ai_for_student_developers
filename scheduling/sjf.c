#include<stdio.h>

int main() {
    int i, j, n, p[20], bt[20], wt[20], tat[20], temp;
    float wtavg, tatavg;

    printf("Enter number of processes: ");
    scanf("%d", &n);

    printf("Enter Burst Time:\n");
    for(i=0; i<n; i++) {
        p[i] = i; // Store Process ID
        printf("P%d: ", i);
        scanf("%d", &bt[i]);
    }

    // Sorting by Burst Time (Bubble Sort)
    for(i=0; i<n; i++) {
        for(j=0; j<n-i-1; j++) {
            if(bt[j] > bt[j+1]) {
                // Swap Burst Time
                temp = bt[j]; bt[j] = bt[j+1]; bt[j+1] = temp;
                // Swap Process ID
                temp = p[j]; p[j] = p[j+1]; p[j+1] = temp;
            }
        }
    }

    wt[0] = 0;
    tat[0] = bt[0];

    for(i=1; i<n; i++) {
        wt[i] = wt[i-1] + bt[i-1];
        tat[i] = wt[i] + bt[i];
    }

    printf("\nProcess\tBurst\tWaiting\tTurnaround\n");
    for(i=0; i<n; i++) {
        printf("P%d\t%d\t%d\t%d\n", p[i], bt[i], wt[i], tat[i]);
        wtavg += wt[i];
        tatavg += tat[i];
    }

    printf("\nAvg Waiting Time: %.2f", wtavg/n);
    printf("\nAvg Turnaround Time: %.2f\n", tatavg/n);
    return 0;
}