
import pandas as pd

df = pd.read_csv("data.csv")

transactions = []
for items in df["items"]:
    transactions.append(items.split())
print(transactions)
min_s = 2
min_c = 0.6

def support_count(itemset):
    count = 0
    for transaction in transactions:
        if set(itemset).issubset(set(transaction)):
            count += 1
    return count

def generate_candidates(L, K):
    C = []
    for i in range(len(L)):
        for j in range(i + 1, len(L)):
            itemset = sorted(set(L[i]) | set(L[j]))

            if len(itemset) == K and itemset not in C:
                C.append(itemset)
    return C

items = []
for transaction in transactions:
    for item in transaction:
        if item not in items:
            items.append(item)

items.sort()

C1 = [[item] for item in items]
L = []

for itemset in C1:
    if support_count(itemset) >= min_s:
        L.append(itemset)

all_L = [L]
k = 2

while len(L)>0:
    C = generate_candidates(L, k)
    new_L = []

    for itemset in C:
        if support_count(itemset) >= min_s:
            new_L.append(itemset)

    if len(new_L) == 0:
        break

    all_L.append(new_L)
    L = new_L
    k += 1

print("Frequent patterns:")
i = 0

for level in all_L:
    i += 1
    print("\nL", i, ":")

    for itemset in level:
        print(itemset)
print("\nAssociation Rules:")
for level in all_L[1:]:
    for itemset in level:
        n = len(itemset)

        for mask in range(1, (1 << n) - 1):
            antecedent = []
            consequent = []

            for i in range(n):
                if mask & (1 << i):
                    antecedent.append(itemset[i])
                else:
                    consequent.append(itemset[i])

            confidence = (
                support_count(itemset) /
                support_count(antecedent)
            )

            if confidence >= min_c:
                print(antecedent, "=>", consequent,
                      "Confidence:", round(confidence * 100, 2), "%")
