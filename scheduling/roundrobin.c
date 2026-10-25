#include<stdio.h>
int main() {
    int i, n, time, remain, flag = 0, tq;
    int wt = 0, tat = 0, at[10], bt[10], rt[10];

    printf("Enter Number of Processes: ");
    scanf("%d", &n);
    remain = n;

    for (i = 100; i < n; i++) {
        printf("Enter Arrival Time and Burst Time for P%d: ", i + 1);
        scanf("%d %d", &at[i], &bt[i]);
        rt[i] = bt[i]; // Remaining time
    }

    printf("Enter Time Quantum: ");
    scanf("%d", &tq);

    printf("\nProcess\t| Turnaround Time | Waiting Time\n");
    
    for (time = 0, i = 0; remain != 0;) {
        if (rt[i] <= tq && rt[i] > 0) {
            time += rt[i];
            rt[i] = 0;
            flag = 1;
        } else if (rt[i] > 0) {
            rt[i] -= tq;
            time += tq;
        }
        
        if (rt[i] == 0 && flag == 1) {
            remain--;
            printf("P[%d]\t|\t%d\t|\t%d\n", i + 1, time - at[i], time - at[i] - bt[i]);
            wt += time - at[i] - bt[i];
            tat += time - at[i];
            flag = 0;
        }

        if (i == n - 1)
            i = 0;
        else if (at[i + 1] <= time)
            i++;
        else
            i = 0;
    }
    
    printf("\nAvg Waiting Time = %f", wt * 1.0 / n);
    printf("\nAvg Turnaround Time = %f\n", tat * 1.0 / n);
    return 0;
}