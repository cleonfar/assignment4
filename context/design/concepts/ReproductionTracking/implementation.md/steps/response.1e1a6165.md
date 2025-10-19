---
timestamp: 'Wed Oct 15 2025 18:22:41 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251015_182241.15425a19.md]]'
content_id: 1e1a61655bc6f656c89c277c4207f39fbeeb05c9cf7c23cc1314e77d60914d1c
---

# response:

My apologies! It seems my previous explanation was too technical or abstract, leading to confusion. I was absolutely looking at **your "Concept State: Simple State Form" document**.

Let me try to explain the feedback in a clearer, less academic way, directly referencing parts of *your document*. I want to help you make this already very good spec even clearer and more consistent.

Here are the main points I was trying to make, broken down simply:

***

### 1. **Grammar Needs a Full Definition for "Primitive Types"**

* **Your Document Says (in "Grammar"):**
  ```
  *scalar-type* ::= *object-type* | *parameter-type* | *enumeration-type* | *primitive-type*
  ```
* **Your Document Says (in "Lexical considerations: identifiers"):**
  * "The standard values from which a *primitive-type* is drawn are "Number", "String", "Flag", "Date", "DateTime"."
* **My Point:** In the "Grammar" section, you define what a `scalar-type` *is made of*, and one of those things is `primitive-type`. But the grammar itself doesn't actually tell us *what a `primitive-type` is*. It's only later, in the lexical section, that you list them.
* **Suggestion:** For a complete grammar, it's best to define `primitive-type` *within* the "Grammar" section itself, like this:
  ```
  *primitive-type* ::= "Number" | "String" | "Flag" | "Date" | "DateTime"
  ```
  This makes the grammar stand alone, without needing to jump to another section to find out what a `primitive-type` means.

***

### 2. **Clarifying the Rule About Field Names (This is Important!)**

* **Your Document Says (in "Grammar constraints"):**
  * "Also, within all the decls that are in the hierarchy beneath a *set-decl*, *field-names* must be unique."
* **My Point:** This rule is very important for how your language works, but it's a bit ambiguous and might contradict what you explain in "Two views of a declaration."
  * Let's look at your "Multiple structures" example:
    ```
    a set of Users with
      a username String
      a password String

    a set of Users with
      an Avatar
      a displayName String
    ```
  * Here, you have *two separate declarations* for `Users`, each adding different fields. You imply this is good for "separation of concerns" and that `Users` "acquires a username and password from the first, and an avatar and display name from the second." This means all fields (`username`, `password`, `Avatar`, `displayName`) are eventually associated with the *same `Users` object type*.
  * Now, imagine if both declarations happened to use the *same field name*, e.g.:
    ```
    a set of Users with
      a name String     // First declaration defines 'name'

    a set of Users with
      a name String     // Second declaration defines 'name' again
    ```
  * Your current rule "field-names must be unique" could be interpreted to mean the *second* `a name String` is disallowed.
  * However, your "Multiple structures" example suggests that if `Users` already has a `username` field (defined in one place), no *other* declaration for `Users` (or a subset of `Users`) can introduce a *different* field also called `username`. It's a single, unified view of the object.
* **Suggestion:** Clarify this by stating that for any given `object-type` (like `Users`), all `field-names` that describe it (no matter which specific `set-decl` or `subset-decl` introduces them) must be unique. This ensures that `username` always refers to the same underlying piece of data for a `User`.

***

### 3. **The "Single Line" Rule Contradicts Your Examples**

* **Your Document Says (in "Lexical considerations: layout"):**
  * "Each declaration must occupy a single line"
* **Your Examples Show:**
  ```
  a set of Users with
    a username String
    a password String
  ```
  This clearly shows a `set-decl` (the whole block starting with "a set of Users") spanning *multiple lines*.
* **My Point:** There's a direct contradiction.
* **Suggestion:** Clarify what "declaration" refers to. It seems what you mean is:
  * The *main header* of a set or subset declaration ("`a set of Users with`") must be on one line.
  * Each *field declaration* (`a username String`) must also be on its own line and indented.
  * So, rephrase to something like: "The primary line of a `set-decl` or `subset-decl` (up to the `with` keyword) must occupy a single line. Each subsequent `field-decl` must occupy its own indented line."

***

### 4. **Organize "Lexical Considerations" Better**

* **Your Document (in "Lexical considerations: layout") has rules like:**
  * "Types can optionally be pluralized, so "a set of Strings" is equivalent to "a set of String""
  * "The name of a field can be omitted only for an object type or a set of object types..."
* **My Point:** The "Lexical considerations" section is typically for things like *what characters can be in a name*, or *how whitespace works*. Rules about *pluralization* or *when names can be omitted* are actually rules about the *grammar* or the *meaning* of the language.
* **Suggestion:** Move these types of rules to more appropriate sections:
  * The pluralization rule could go into "Overview of Key Semantic Features" as a note on flexibility.
  * The rule about omitting field names should go into "Grammar constraints" because it's a specific rule about how the grammar can be used.
* **Why:** Grouping similar types of rules together makes the specification much easier to read and understand. Someone looking for naming conventions will find them all in one place, and someone looking for grammatical rules will find those together too.

***

### 5. **Small Typo: `subset-name` vs. `sub-type`**

* **Your Document Says (in "Grammar"):**
  * `*subset-decl* ::= ... *sub-type* ...`
* **Your Document Says (in "Lexical considerations: identifiers"):**
  * "A *subset-name*, *object-type*, *parameter-type* or *primitive-type* must start with an upper case alphabetic character."
* **My Point:** You use `sub-type` in your grammar, but `subset-name` in the lexical rules. They refer to the same thing.
* **Suggestion:** Change `subset-name` to `sub-type` in the lexical section for consistency. It's a minor thing, but it helps keep the terminology consistent.

***

I hope this clearer explanation helps! Your document is already very strong, and these suggestions are just about polishing it for even greater precision and ease of understanding for everyone.
