#include<stdio.h>

int main() {
    int i, j, n, bt[20], p[20], wt[20], tat[20], pr[20], temp;
    float wtavg, tatavg;

    printf("Enter number of processes: ");
    scanf("%d", &n);

    for(i=0; i<n; i++) {
        p[i] = i;
        printf("Enter Burst Time & Priority for P%d: ", i);
        scanf("%d %d", &bt[i], &pr[i]);
    }

    // Sort by Priority
    for(i=0; i<n; i++) {
        for(j=0; j<n-i-1; j++) {
            if(pr[j] > pr[j+1]) { // Swap if priority is lower (higher number)
                temp = pr[j]; pr[j] = pr[j+1]; pr[j+1] = temp;
                temp = bt[j]; bt[j] = bt[j+1]; bt[j+1] = temp;
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

    printf("\nProcess\tPri\tBurst\tWait\tTAT\n");
    for(i=0; i<n; i++) {
        printf("P%d\t%d\t%d\t%d\t%d\n", p[i], pr[i], bt[i], wt[i], tat[i]);
        wtavg += wt[i];
        tatavg += tat[i];
    }

    printf("\nAvg Waiting Time: %.2f", wtavg/n);
    printf("\nAvg Turnaround Time: %.2f\n", tatavg/n);
    return 0;
}