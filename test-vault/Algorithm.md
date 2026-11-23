# Euclid's Algorithm

```algo
Algorithm Euclid(a, b)
Input: Two integers a, b > 0
Output: gcd(a, b)
while b != 0 do
  r <- a mod b
  a <- b
  b <- r
return a
```
