const { userModel } = require("../models");
const httpStatus = require("http-status");
const {
  hashPassword,
  comparePassword,
  generateTokenPayload,
  verifyJWTRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  isTokenExpired,
} = require("../services/auth-service");

async function signup(req, res) {
  //create new User obj.
  const userInfor = { ...req.body };
  //hash password.
  try {
    userInfor.password = await hashPassword(req.body.password);
  } catch (err) {
    console.log("hashPassword error: ", err);
    return res.sendStatus(httpStatus.INTERNAL_SERVER_ERROR);
  }

  //store newUser to db.
  const newUser = new userModel(userInfor);
  newUser.save((err) => {
    if (err) {
      const errorObj = { errCode: err.code, errMessage: "" };
      switch (err.code) {
        case 11000: //"name" or "email" already exist.
          const key = Object.keys(err.keyValue)[0];
          errorObj.errMessage = `'${err.keyValue[key]}' already exist. Select another ${key}.`;
          return res.status(httpStatus.CONFLICT).json(errorObj); //409 - CONFLICT

        default:
          return res.sendStatus(httpStatus.INTERNAL_SERVER_ERROR);
      }
    }
    res.sendStatus(httpStatus.CREATED); // 201 - CREATED
  });
}

/*{
    "name": "loo",
    "email": "loo@hotmail.com",
    "password": "123"    }
  {
    "name":"John",
    "email":"hy@gmail.com",
    "password":"123"    } */

async function login(req, res) {
  const { email, password } = req.body;
  try {
    /* find user using email. 
        if found, foundUser = 
{
  _id: new ObjectId("639093631ef58da7e22374a3"),
  email: 'loo@hotmail.com',
  password: '$2b$10$N.ZUvX98A2n1F2YkJBdqL.k2keQPCD5iPWyX5zqyXxe73hzS/9QyG',
  role: 'user'
}
       if not found, foundUser = null    */
    const foundUser = await userModel.findOne(
      { email: email.toLowerCase() },
      "name password role"
    );
    if (!foundUser) return res.sendStatus(httpStatus.NOT_FOUND); //404

    // check password match? ; Boolen result.
    const passwordOK = await comparePassword(password, foundUser.password);
    if (!passwordOK) return res.sendStatus(httpStatus.FORBIDDEN); //403

    //generate tokenPayload
    const tokenPayload = generateTokenPayload(foundUser);

    //generate accessToken and refreshToken generateRefreshToken
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.status(httpStatus.OK).json({ accessToken, refreshToken }); //200
  } catch (err) {
    res.sendStatus(httpStatus.INTERNAL_SERVER_ERROR);
  }
}

async function getNewAccessToken(req, res) {
  try {
    // extract token
    const bearer_Token = req.headers.authorization;
    const refreshToken = bearer_Token.split(" ")[1];

    //decoded decoded payload object
    const userObj = await verifyJWTRefreshToken(refreshToken);

    // check if refreshToken has expired.
    if (isTokenExpired(userObj.exp)) {
      return res.sendStatus(httpStatus.UNAUTHORIZED);
    }

    // if token not expired, get new tokenPayload
    const tokenPayload = generateTokenPayload(userObj);

    //generate new accessToken
    const accessToken = generateAccessToken(tokenPayload);
    res.status(httpStatus.OK).json({ accessToken }); //200
  } catch (err) {
    res.sendStatus(httpStatus.UNAUTHORIZED); //401
  }
}

module.exports = { signup, login, getNewAccessToken };